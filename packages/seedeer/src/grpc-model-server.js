#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createModelServerCore } from './shared/model-server-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, 'shared', 'model.proto');

/**
 * Starts a gRPC server hosting a single seedeer engine, exposing it as a
 * typed HTTP/2 service — local or remote (e.g. a GPU VPS spun up on
 * demand). WorkerPool's 'grpc' mode is the client side — see
 * shared/grpc-client.js.
 *
 * @param {object} options
 * @param {string} options.enginePath      Engine module to load.
 * @param {object} [options.engineOptions]
 * @param {number} [options.concurrency]   Local worker count backing this server.
 * @param {string} [options.host]          Default: '0.0.0.0'
 * @param {number} [options.port]          Default: 50051
 * @returns {Promise<{close(): Promise<void>}>}
 */
export async function startGrpcServer({ enginePath, engineOptions, concurrency, host = '0.0.0.0', port = 50051 } = {}) {
  if (!enginePath) throw new Error('startGrpcServer requires an enginePath.');

  const grpc = await import('@grpc/grpc-js');
  const protoLoader = await import('@grpc/proto-loader');
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDef).seedeer;

  const core = createModelServerCore({ enginePath, engineOptions, concurrency });
  await core.start();

  const server = new grpc.Server();
  server.addService(proto.ModelService.service, {
    async Run(call, callback) {
      try {
        const task = JSON.parse(Buffer.from(call.request.payload).toString('utf8'));
        const result = await core.run(task);
        callback(null, { ok: true, payload: Buffer.from(JSON.stringify(result)) });
      } catch (err) {
        callback(null, { ok: false, payload: Buffer.from(JSON.stringify({ message: err.message })) });
      }
    },
  });

  const boundPort = await new Promise((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err, p) => {
      if (err) return reject(err);
      resolve(p);
    });
  });

  return {
    address: `${host}:${boundPort}`,
    async close() {
      await new Promise((resolve) => server.tryShutdown(resolve));
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

  startGrpcServer({
    enginePath,
    engineOptions,
    concurrency,
    host: process.env.SEEDEER_HOST,
    port: process.env.SEEDEER_PORT ? Number(process.env.SEEDEER_PORT) : undefined,
  })
    .then((s) => process.stdout.write(`seedeer gRPC server listening on ${s.address}\n`))
    .catch((err) => {
      process.stderr.write(`${err.stack}\n`);
      process.exit(1);
    });
}
