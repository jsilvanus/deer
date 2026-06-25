import { fork } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FifoQueue } from './fifo-queue.js';
import { connectSocketClients } from './socket-client.js';
import { connectGrpcClients } from './grpc-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROCESS_ENTRY = path.join(__dirname, 'process-worker-entry.js');
const THREAD_ENTRY = path.join(__dirname, 'thread-worker-entry.js');

let nextTaskId = 0;

/**
 * Manages a fixed-size pool of persistent workers, each running an
 * "engine" module (a JS module exporting `createEngine(options)` ->
 * `{ run(task), dispose() }`). The engine is loaded once per worker and
 * reused across many `run()` calls.
 *
 * Modes:
 *   'process' (default) — isolated OS child processes. A worker crash
 *      rejects only its in-flight task; the pool and queue continue.
 *   'thread' — worker_threads in the same process. Lower overhead, same
 *      crash-isolation contract.
 *   'socket' — connects as a client to one or more already-running
 *      socket-model-server instances (see socket-model-server.js).
 *   'grpc' — connects as a client to one or more already-running
 *      grpc-model-server instances (see grpc-model-server.js).
 */
export class WorkerPool {
  #enginePath;
  #engineOptions;
  #mode;
  #concurrency;
  #servers;
  #workers = [];
  #queue = new FifoQueue();
  #pending = new Map();
  #remoteClients = null;
  #remoteIndex = 0;
  #ready = false;
  #initPromise = null;

  /**
   * @param {string} enginePath               Absolute path/module specifier for the engine module.
   * @param {object} [options]
   * @param {string} [options.mode]           'process' | 'thread' | 'socket' | 'grpc' (default: 'process')
   * @param {number} [options.concurrency]    Local worker count (default: min(4, cpus))
   * @param {object} [options.engineOptions]  Passed verbatim to createEngine() on each worker.
   * @param {Array}  [options.servers]        For 'socket'/'grpc': server addresses to round-robin across.
   */
  constructor(enginePath, options = {}) {
    this.#enginePath = enginePath;
    this.#mode = options.mode ?? 'process';
    this.#concurrency = options.concurrency ?? Math.max(1, Math.min(4, os.cpus().length));
    this.#engineOptions = options.engineOptions ?? {};
    this.#servers = options.servers;

    if (!['process', 'thread', 'socket', 'grpc'].includes(this.#mode)) {
      throw new Error(`Unknown WorkerPool mode "${this.#mode}". Expected "process", "thread", "socket", or "grpc".`);
    }
  }

  async initialize() {
    if (this.#ready) return;
    // Concurrent callers may race in before #ready flips; memoize the
    // in-flight promise so we never spawn workers/connections twice.
    if (!this.#initPromise) {
      this.#initPromise = this.#doInitialize();
    }
    await this.#initPromise;
  }

  async #doInitialize() {
    if (this.#mode === 'process' || this.#mode === 'thread') {
      await this.#spawnLocalWorkers();
    } else if (this.#mode === 'socket') {
      this.#remoteClients = await connectSocketClients(this.#servers);
    } else {
      this.#remoteClients = await connectGrpcClients(this.#servers);
    }
    this.#ready = true;
  }

  async run(task) {
    await this.initialize();

    if (this.#remoteClients) {
      const client = this.#remoteClients[this.#remoteIndex % this.#remoteClients.length];
      this.#remoteIndex += 1;
      return client.run(task);
    }

    return new Promise((resolve, reject) => {
      const id = nextTaskId++;
      this.#pending.set(id, { resolve, reject });
      const job = { id, task };
      const idle = this.#workers.find((w) => w.alive && !w.busy);
      if (idle) this.#dispatch(idle, job);
      else this.#queue.push(job);
    });
  }

  async destroy() {
    if (this.#remoteClients) {
      await Promise.all(this.#remoteClients.map((c) => c.close()));
      this.#remoteClients = null;
    }
    await Promise.all(this.#workers.map((record) => this.#destroyWorker(record)));
    this.#workers = [];
    this.#ready = false;
    this.#initPromise = null;
  }

  async #spawnLocalWorkers() {
    const entry = this.#mode === 'process' ? PROCESS_ENTRY : THREAD_ENTRY;
    const inits = [];
    for (let i = 0; i < this.#concurrency; i++) {
      const worker = this.#mode === 'process' ? fork(entry) : new Worker(entry);
      const record = { worker, busy: false, alive: true, currentJobId: undefined, listening: false };
      this.#workers.push(record);
      inits.push(this.#initWorker(record));
    }
    await Promise.all(inits);
  }

  #send(record, msg) {
    if (this.#mode === 'process') record.worker.send(msg);
    else record.worker.postMessage(msg);
  }

  async #initWorker(record) {
    await new Promise((resolve, reject) => {
      const onMessage = (msg) => {
        if (msg.type === 'ready') {
          record.worker.off('message', onMessage);
          resolve();
        } else if (msg.type === 'error') {
          record.worker.off('message', onMessage);
          reject(new Error(msg.error.message));
        }
      };
      record.worker.on('message', onMessage);
      record.worker.on('exit', (code) => {
        record.alive = false;
        if (record.currentJobId !== undefined) {
          const pending = this.#pending.get(record.currentJobId);
          this.#pending.delete(record.currentJobId);
          pending?.reject(new Error(`Worker exited (code ${code}) while processing this task.`));
        }
      });
      this.#send(record, {
        type: 'init',
        enginePath: this.#enginePath,
        engineOptions: this.#engineOptions,
      });
    });
    this.#listen(record);
  }

  #listen(record) {
    if (record.listening) return;
    record.listening = true;
    record.worker.on('message', (msg) => {
      if (msg.type !== 'result' && msg.type !== 'error') return;
      const pending = this.#pending.get(msg.id);
      this.#pending.delete(msg.id);
      record.busy = false;
      record.currentJobId = undefined;
      this.#drain(record);
      if (!pending) return;
      if (msg.type === 'error') pending.reject(new Error(msg.error.message));
      else pending.resolve(msg.result);
    });
  }

  #dispatch(record, job) {
    record.busy = true;
    record.currentJobId = job.id;
    this.#send(record, { type: 'task', id: job.id, task: job.task });
  }

  #drain(record) {
    if (record.busy || !record.alive) return;
    const job = this.#queue.shift();
    if (job) this.#dispatch(record, job);
  }

  async #destroyWorker(record) {
    if (!record.alive) return;
    try {
      this.#send(record, { type: 'shutdown' });
    } catch {
      /* worker may already be gone */
    }
    if (this.#mode === 'process') record.worker.kill();
    else await record.worker.terminate();
  }
}
