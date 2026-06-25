import os from 'node:os';
import path from 'node:path';

/** Default model cache directory, mirroring embedeer's ~/.embedeer/models convention. */
export function defaultCacheDir() {
  return path.join(os.homedir(), '.seedeer', 'models');
}
