#!/usr/bin/env node
import fs from 'node:fs';
import net from 'node:net';
import readline from 'node:readline';
import { createModelServerCore } from './shared/model-server-core.js';
import { defaultSocketPath } from './shared/socket-client.js';

/**
 * Starts a persistent socket daemon hosting a single seedeer engine,
 * shared across OS processes on the same host via a Unix domain socket
 * (or, on a given host/port, TCP). WorkerPool's 'socket' mode is the
 * client side of this protocol — see shared/socket-client.js.
 *
 * @param {object} options
 * @param {string} options.enginePath           Engine module to load (e.g. an embed/caption/vqa engine).
 * @param {object} [options.engineOptions]      Passed verbatim to the engine.
 * @param {number} [options.concurrency]        Local worker count backing this daemon.
 * @param {string} [options.socketPath]         Unix socket path (default: os.tmpdir()/seedeer.sock).
 * @param {string} [options.host]               Use TCP instead of a Unix socket.
 * @param {number} [options.port]               Required when `host` is set.
 * @returns {Promise<{close(): Promise<void>}>}
 */
export async function startSocketServer({
  enginePath,
  engineOptions,
  concurrency,
  socketPath,
  host,
  port,
} = {}) {
  if (!enginePath) throw new Error('startSocketServer requires an enginePath.');

  const core = createModelServerCore({ enginePath, engineOptions, concurrency });
  await core.start();

  const useTcp = Boolean(host);
  const resolvedSocketPath = socketPath ?? defaultSocketPath();
  if (!useTcp) {
    await fs.promises.rm(resolvedSocketPath, { force: true }).catch(() => {});
  }

  const server = net.createServer((socket) => {
    const rl = readline.createInterface({ input: socket });
    rl.on('line', async (line) => {
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      try {
        const result = await core.run(msg.task);
        socket.write(`${JSON.stringify({ id: msg.id, ok: true, result })}\n`);
      } catch (err) {
        socket.write(`${JSON.stringify({ id: msg.id, ok: false, error: { message: err.message } })}\n`);
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    if (useTcp) server.listen(port, host, resolve);
    else server.listen(resolvedSocketPath, resolve);
  });

  return {
    address: useTcp ? `${host}:${port}` : resolvedSocketPath,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await core.stop();
    },
  };
}

function isMainModule() {
  return process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
}

if (isMainModule()) {
  const enginePath = process.env.SEEDEER_ENGINE_PATH;
  if (!enginePath) {
    process.stderr.write(
      'SEEDEER_ENGINE_PATH env var is required (path to an engine module exporting createEngine()).\n',
    );
    process.exit(1);
  }
  const engineOptions = JSON.parse(process.env.SEEDEER_ENGINE_OPTIONS ?? '{}');
  const concurrency = process.env.SEEDEER_CONCURRENCY ? Number(process.env.SEEDEER_CONCURRENCY) : undefined;

  startSocketServer({
    enginePath,
    engineOptions,
    concurrency,
    socketPath: process.env.SEEDEER_SOCKET_PATH,
    host: process.env.SEEDEER_HOST,
    port: process.env.SEEDEER_PORT ? Number(process.env.SEEDEER_PORT) : undefined,
  })
    .then((s) => process.stdout.write(`seedeer socket daemon listening on ${s.address}\n`))
    .catch((err) => {
      process.stderr.write(`${err.stack}\n`);
      process.exit(1);
    });
}
