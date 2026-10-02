// Develops plates off the main thread, so captures and developing overlap across the machine's cores.
import { parentPort } from 'node:worker_threads';
import { develop } from './material.mjs';

parentPort.on('message', ({ id, params }) => {
  const pixels = develop({
    ...params,
    capture: new Uint8Array(params.capture),
    fluorescent: params.fluorescent ? new Uint8Array(params.fluorescent) : undefined,
  });
  parentPort.postMessage({ id, pixels: pixels.buffer }, [pixels.buffer]);
});
