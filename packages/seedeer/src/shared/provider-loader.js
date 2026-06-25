import fs from 'node:fs';
import os from 'node:os';

const NVIDIA_DEVICE_NODE = '/dev/nvidiactl';

function hasNvidiaGpu() {
  try {
    return fs.existsSync(NVIDIA_DEVICE_NODE);
  } catch {
    return false;
  }
}

/**
 * Resolves a `device`/`provider` option pair into the execution-provider
 * string @huggingface/transformers expects ('cpu' | 'cuda' | 'dml').
 *
 * - An explicit `provider` always wins.
 * - `device: 'cpu'` always returns 'cpu'.
 * - `device: 'gpu'` requires a supported GPU provider and throws if none is
 *   detected, so a caller who explicitly asked for GPU finds out why it
 *   didn't happen.
 * - `device: 'auto'` (default) prefers GPU when detected and silently
 *   falls back to CPU otherwise.
 *
 * GPU detection here is a presence check (NVIDIA device node on Linux x64,
 * platform check for DirectML on Windows x64) — it does not verify that
 * the matching CUDA/cuDNN userspace libraries are installed. If they're
 * missing, onnxruntime-node will raise a clear native error at model load
 * time; duplicating that verification here isn't worth the added surface.
 *
 * @param {object} [options]
 * @param {string} [options.device]    'cpu' | 'gpu' | 'auto' (default: 'auto')
 * @param {string} [options.provider]  Explicit override: 'cpu' | 'cuda' | 'dml'
 * @returns {string}
 */
export function resolveDevice({ device = 'auto', provider } = {}) {
  if (provider) return provider;

  if (device === 'cpu') return 'cpu';

  if (device !== 'gpu' && device !== 'auto') {
    throw new Error(`Unknown device "${device}". Expected "cpu", "gpu", or "auto".`);
  }

  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'linux' && arch === 'x64' && hasNvidiaGpu()) return 'cuda';
  if (platform === 'win32' && arch === 'x64') return 'dml';

  if (device === 'gpu') {
    throw new Error(
      `No supported GPU execution provider detected for ${platform}/${arch}. ` +
        'Use device: "auto" to fall back to CPU automatically, or device: "cpu" explicitly.',
    );
  }

  return 'cpu';
}
