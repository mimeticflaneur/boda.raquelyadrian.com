'use strict';
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Redis real y efímero, sin puerto público, disco persistente ni datos reales.
async function startRedis() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boda-redis-test-'));
  const socket = path.join(dir, 'redis.sock');
  const child = spawn(process.env.REDIS_SERVER || 'redis-server', ['--port', '0', '--unixsocket', socket, '--save', '', '--appendonly', 'no'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis no arrancó')), 10000);
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.stdout.on('data', () => { if (fs.existsSync(socket)) { clearTimeout(timer); resolve(); } });
  });
  function command(parts) {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(socket);
      let buffer = Buffer.alloc(0);
      client.on('connect', () => {
        const chunks = [Buffer.from(`*${parts.length}\r\n`)];
        for (const part of parts) { const value = Buffer.from(String(part)); chunks.push(Buffer.from(`$${value.length}\r\n`), value, Buffer.from('\r\n')); }
        client.write(Buffer.concat(chunks));
      });
      function parse(offset = 0) {
        const end = buffer.indexOf('\r\n', offset); if (end < 0) return;
        const type = String.fromCharCode(buffer[offset]), value = buffer.toString('utf8', offset + 1, end);
        let next = end + 2;
        if (type === '+') return { value, next };
        if (type === '-') throw new Error(value);
        if (type === ':') return { value: Number(value), next };
        if (type === '$') {
          const length = Number(value); if (length === -1) return { value: null, next };
          if (buffer.length < next + length + 2) return;
          return { value: buffer.toString('utf8', next, next + length), next: next + length + 2 };
        }
        if (type === '*') {
          const values = [];
          for (let i = 0; i < Number(value); i++) { const r = parse(next); if (!r) return; values.push(r.value); next = r.next; }
          return { value: values, next };
        }
        throw new Error('RESP inesperado');
      }
      client.on('error', reject);
      client.on('data', data => {
        buffer = Buffer.concat([buffer, data]);
        try { const result = parse(); if (result) { client.end(); resolve(result.value); } }
        catch (e) { client.end(); reject(e); }
      });
    });
  }
  const rest = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer test-only') { res.writeHead(401); res.end('{}'); return; }
    try { const result = await command(JSON.parse(Buffer.concat(chunks))); res.end(JSON.stringify({ result })); }
    catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
  });
  await new Promise(resolve => rest.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${rest.address().port}`, command,
    async close() {
      await new Promise(resolve => { rest.close(resolve); rest.closeAllConnections(); });
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}
module.exports = { startRedis };
