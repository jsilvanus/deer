import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, 'model.proto');

export function defaultGrpcTarget() {
  return '127.0.0.1:50051';
}

async function loadModelServiceClient() {
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
  return { grpc, ModelService: proto.ModelService };
}

/**
 * Connects to one or more grpc-model-server instances and returns a
 * `{ run(task), close() }` client per target, for WorkerPool's 'grpc'
 * mode to round-robin across.
 *
 * @param {Array<string>} [servers] e.g. ['10.0.0.5:50051']. Defaults to localhost.
 */
export async function connectGrpcClients(servers) {
  const targets = (servers && servers.length > 0) ? servers : [defaultGrpcTarget()];
  const { grpc, ModelService } = await loadModelServiceClient();
  return targets.map((target) => {
    const client = new ModelService(target, grpc.credentials.createInsecure());
    return {
      run(task) {
        return new Promise((resolve, reject) => {
          client.Run({ payload: Buffer.from(JSON.stringify(task)) }, (err, response) => {
            if (err) return reject(err);
            const parsed = JSON.parse(Buffer.from(response.payload).toString('utf8'));
            if (!response.ok) return reject(new Error(parsed.message ?? 'Remote task failed'));
            resolve(parsed);
          });
        });
      },
      async close() {
        client.close();
      },
    };
  });
}
