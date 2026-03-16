const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const HOST = '127.0.0.1';
const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPENCLAW_CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const AUTH_PROFILES_PATH = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
const OPENCLAW_CHAT_BASE_URL = 'http://127.0.0.1:18789/chat?session=agent%3Amain%3Amain#token=';

const CLI_COMMANDS = {
  install_update: 'curl -fsSL https://openclaw.ai/install.sh | bash',
  gateway_restart: 'openclaw gateway restart',
  gateway_install: 'openclaw gateway install'
};

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 500, { ok: false, error: '读取页面失败。' });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function runCommand(command) {
  return new Promise((resolve) => {
    exec(command, { shell: '/bin/bash', timeout: 15 * 60 * 1000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error ? error.code : 0,
        signal: error ? error.signal : null,
        stdout: stdout || '',
        stderr: stderr || '',
        message: error ? `执行失败: ${error.message}` : '执行成功。'
      });
    });
  });
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJsonFile(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 20000) {
        reject(new Error('请求体过大。'));
        req.socket.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function getProfileToken(profileConfig) {
  return profileConfig?.key || profileConfig?.token || profileConfig?.apiKey || profileConfig?.api_key || '';
}

function setProfileToken(profileConfig, token) {
  if (Object.prototype.hasOwnProperty.call(profileConfig, 'key')) {
    profileConfig.key = token;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(profileConfig, 'token')) {
    profileConfig.token = token;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(profileConfig, 'apiKey')) {
    profileConfig.apiKey = token;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(profileConfig, 'api_key')) {
    profileConfig.api_key = token;
    return;
  }
  profileConfig.key = token;
}

function validateTokenFormat(token) {
  if (typeof token !== 'string') {
    return { ok: false, error: 'Token 必须是字符串。' };
  }
  if (!token) {
    return { ok: false, error: 'Token 不能为空。' };
  }
  if (/\s/.test(token)) {
    return { ok: false, error: 'Token 不能包含空格或换行。' };
  }
  if (token.length < 20) {
    return { ok: false, error: 'Token 长度过短（至少 20 位）。' };
  }
  if (token.length > 512) {
    return { ok: false, error: 'Token 长度过长（最多 512 位）。' };
  }
  if (!/^[\x21-\x7E]+$/.test(token)) {
    return { ok: false, error: 'Token 仅允许可见 ASCII 字符。' };
  }
  return { ok: true };
}

function getModelTokenList() {
  const authProfiles = readJsonFile(AUTH_PROFILES_PATH);
  const profiles = authProfiles?.profiles;
  if (!profiles || typeof profiles !== 'object') {
    throw new Error(`配置格式异常：${AUTH_PROFILES_PATH} 缺少 profiles`);
  }
  return Object.keys(profiles)
    .sort((a, b) => a.localeCompare(b))
    .map((model) => ({
      model,
      token: getProfileToken(profiles[model]) || ''
    }));
}

function updateModelToken(model, newToken) {
  const authProfiles = readJsonFile(AUTH_PROFILES_PATH);
  const profiles = authProfiles?.profiles;
  if (!profiles || typeof profiles !== 'object') {
    throw new Error(`配置格式异常：${AUTH_PROFILES_PATH} 缺少 profiles`);
  }
  if (!Object.prototype.hasOwnProperty.call(profiles, model)) {
    return { ok: false, error: '未找到该模型配置。' };
  }
  const validation = validateTokenFormat(newToken);
  if (!validation.ok) {
    return validation;
  }
  setProfileToken(profiles[model], newToken);
  writeJsonFile(AUTH_PROFILES_PATH, authProfiles);
  return { ok: true };
}

function getFrontendAddressResult() {
  try {
    const raw = fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);
    const token = config?.gateway?.token || config?.gateway?.auth?.token;
    if (!token || typeof token !== 'string') {
      return {
        ok: false,
        code: 1,
        signal: null,
        stdout: '',
        stderr: `未找到 token。请检查 ${OPENCLAW_CONFIG_PATH} 的 gateway.token 或 gateway.auth.token`,
        message: '读取 token 失败。'
      };
    }
    const address = `${OPENCLAW_CHAT_BASE_URL}${encodeURIComponent(token)}`;
    return {
      ok: true,
      code: 0,
      signal: null,
      stdout: address,
      stderr: '',
      address,
      message: '地址获取成功。'
    };
  } catch (error) {
    return {
      ok: false,
      code: 1,
      signal: null,
      stdout: '',
      stderr: '',
      message: `读取配置失败: ${error.message}`
    };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && url.pathname === '/api/model-tokens') {
    try {
      const models = getModelTokenList();
      return sendJson(res, 200, { ok: true, source: AUTH_PROFILES_PATH, models });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: `读取模型 token 失败: ${error.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/model-tokens/update') {
    let body = '';
    try {
      body = await readRequestBody(req);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
    let model = '';
    let newToken = '';
    try {
      const parsed = JSON.parse(body || '{}');
      model = parsed.model;
      newToken = parsed.newToken;
    } catch {
      return sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON。' });
    }
    if (!model || typeof model !== 'string') {
      return sendJson(res, 400, { ok: false, error: '请先选择模型。' });
    }
    try {
      const result = updateModelToken(model, newToken);
      if (!result.ok) {
        return sendJson(res, 400, result);
      }
      return sendJson(res, 200, { ok: true, model, message: 'Token 已更新。' });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: `写入模型 token 失败: ${error.message}` });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    let body = '';
    try {
      body = await readRequestBody(req);
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
    let action = '';
    try {
      const parsed = JSON.parse(body || '{}');
      action = parsed.action;
    } catch {
      return sendJson(res, 400, { ok: false, error: '请求体不是合法 JSON。' });
    }
    if (action === 'get_frontend_url') {
      const result = getFrontendAddressResult();
      return sendJson(res, 200, { action, command: `读取 ${OPENCLAW_CONFIG_PATH}`, ...result });
    }
    const command = CLI_COMMANDS[action];
    if (!command) {
      return sendJson(res, 400, { ok: false, error: '不支持的操作。' });
    }
    const result = await runCommand(command);
    return sendJson(res, 200, { action, command, ...result });
  }

  sendJson(res, 404, { ok: false, error: '未找到资源。' });
});

server.listen(PORT, HOST, () => {
  console.log(`OpenClaw Assistant 已启动: http://${HOST}:${PORT}`);
});
