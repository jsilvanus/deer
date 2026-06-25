import os from 'node:os';
import path from 'node:path';

/**
 * Returns the default model cache directory.
 * Packages using nudeer should define their own convention
 * (e.g., ~/.embedeer/models, ~/.seedeer/models).
 */
export function defaultCacheDir(appName = 'nudeer') {
  return path.join(os.homedir(), `.${appName}`, 'models');
}
