/**
 * 抖音签名运行时（常驻进程）
 *
 * 用行分隔 JSON 与 Python 通信，避免 PyExecJS 每次调用都 fork 一个 Node。
 * 请求: {"fn":"xbogus","args":["md5hex"]}
 * 响应: {"ok":true,"data":"..."} 或 {"ok":false,"error":"..."}
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const readline = require('readline');

function loadScript(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    require,
    module: { exports: {} },
    exports: {},
    process,
    Buffer,
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    performance: { now: () => Date.now() },
    crypto: require('crypto').webcrypto,
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: path.basename(file) });
  return sandbox;
}

const engines = {};
function engine(name, file) {
  if (!engines[name]) engines[name] = loadScript(path.join(__dirname, file));
  return engines[name];
}

const handlers = {
  // a_bogus: query 是已排序拼接的 query string
  ab: (query, data) => engine('ab', 'dy_ab.js').get_ab(query, data || ''),
  // 私信/IM 的请求签名
  req_sign: (payload, privateKey) =>
    engine('ab', 'dy_ab.js').get_req_sign(payload, privateKey),
  ree_key: (privateKey) => engine('ab', 'dy_ab.js').get_ree_key(privateKey),
  // 直播间 WebSocket 的 X-Bogus
  xbogus: (stub) => {
    const res = engine('live', 'dy_live_sign.js').get_signature(stub);
    return res && res['X-Bogus'] ? res['X-Bogus'] : null;
  },
};

function reply(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    reply({ ok: false, error: 'bad json: ' + e.message });
    return;
  }
  const fn = handlers[req.fn];
  if (!fn) {
    reply({ ok: false, error: 'unknown fn: ' + req.fn });
    return;
  }
  try {
    reply({ ok: true, data: fn.apply(null, req.args || []) });
  } catch (e) {
    reply({ ok: false, error: e.message });
  }
});

rl.on('close', () => process.exit(0));
reply({ ok: true, data: 'ready' });
