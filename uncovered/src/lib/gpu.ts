/*
 * WebGL only where a GPU draws it. With software rendering (a blocklisted GPU,
 * a virtual machine), the compositor reads every changed WebGL frame back from
 * memory, and on this site that held page transitions for seconds. A scene
 * claims its canvas's context here first, with failIfMajorPerformanceCaveat;
 * OGL's Renderer then takes the same context, since a canvas has only one.
 */

let drawn: boolean | undefined;

/**
 * Claim a WebGL context drawn by the GPU on `canvas`, with the attributes the
 * scene's Renderer will ask for. False where only software would draw it, and
 * then the canvas is left without a context.
 */
export function claimGpu(canvas: HTMLCanvasElement, attributes: WebGLContextAttributes): boolean {
  const strict = { ...attributes, failIfMajorPerformanceCaveat: true };
  drawn = Boolean(canvas.getContext('webgl2', strict) ?? canvas.getContext('webgl', strict));
  return drawn;
}

/**
 * Whether a GPU draws this page: answered by a scene's claim, or else asked of
 * WebGL once, the first time it matters, and remembered.
 */
export function gpuDraws(): boolean {
  if (drawn === undefined) {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
    drawn = gl !== null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return drawn;
}
