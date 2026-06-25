import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

export function defaultSocketPath() {
  return path.join(os.tmpdir(), 'nudeer.sock');
}

/**
 * Connects to one or more socket-model-server instances and returns a
 * `{ run(task), close() }` client per server, for WorkerPool's 'socket'
 * mode to round-robin across.
 *
 * @param {Array<string|{path?:string,host?:string,port?:number}>} [servers]
 *   Defaults to a single connection at the conventional local socket path.
 */
export async function connectSocketClients(servers) {
  const targets = (servers && servers.length > 0) ? servers : [defaultSocketPath()];
  return Promise.all(targets.map(connectOne));
}

async function connectOne(target) {
  const connectOptions = typeof target === 'string' ? { path: target } : target;
  const socket = net.createConnection(connectOptions);
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });

  const rl = readline.createInterface({ input: socket });
  const pending = new Map();
  let nextId = 0;

  rl.on('line', (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(msg.error?.message ?? 'Remote task failed'));
  });

  socket.on('error', (err) => {
    for (const entry of pending.values()) entry.reject(err);
    pending.clear();
  });

  return {
    run(task) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        socket.write(`${JSON.stringify({ id, task })}\n`);
      });
    },
    async close() {
      rl.close();
      socket.end();
    },
  };
}
