/*
 * Cartographic terrain shaders. Elevation lives in a float texture (one
 * texel per grid node) so assumption changes upload 37 KB instead of
 * rebuilding geometry, and two textures cross-fade when the company changes.
 *
 * Elevation is ln(value / reference price). Displayed height is compressed
 * with tanh so the band around the coast stays legible while extremes
 * flatten into plateaus.
 */

const heightFn = /* glsl */ `
  uniform sampler2D uElevA;
  uniform sampler2D uElevB;
  uniform float uMorph;
  uniform float uHeight;
  uniform vec2 uTexSize;

  float elevAt(ivec2 p) {
    p = clamp(p, ivec2(0), ivec2(uTexSize) - 1);
    return mix(texelFetch(uElevA, p, 0).r, texelFetch(uElevB, p, 0).r, uMorph);
  }

  float heightOf(float e) {
    return uHeight * 0.95 * tanh(e / 0.95);
  }
`;

export const terrainVertex = /* glsl */ `
  ${heightFn}
  uniform vec2 uSize;

  varying float vElev;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    ivec2 p = ivec2(round(uv * (uTexSize - 1.0)));
    float e = elevAt(p);
    float hL = heightOf(elevAt(p - ivec2(1, 0)));
    float hR = heightOf(elevAt(p + ivec2(1, 0)));
    float hD = heightOf(elevAt(p - ivec2(0, 1)));
    float hU = heightOf(elevAt(p + ivec2(0, 1)));
    float dx = uSize.x / (uTexSize.x - 1.0);
    float dz = uSize.y / (uTexSize.y - 1.0);
    // Rows run from near (+z) to far (−z), so "up" in the grid is −z.
    vNormal = normalize(vec3(-(hR - hL) / (2.0 * dx), 1.0, (hU - hD) / (2.0 * dz)));

    vec3 pos = position;
    pos.y = heightOf(e);
    vElev = e;
    vUv = uv;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const terrainFragment = /* glsl */ `
  uniform float uSeaLevel;
  uniform float uLoadLine;
  uniform vec4 uExtent;
  uniform vec3 uLand1;
  uniform vec3 uLand2;
  uniform vec3 uLand3;
  uniform vec3 uLandLine;
  uniform vec3 uIntertidal;
  uniform vec3 uIntertidalInk;
  uniform vec3 uWater1;
  uniform vec3 uWater2;
  uniform vec3 uWaterLine;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uRule;
  uniform float uDark;

  varying float vElev;
  varying vec3 vNormal;
  varying vec2 vUv;

  // Anti-aliased line where v crosses an integer, about w pixels wide.
  float isoline(float v, float w) {
    float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-5);
    return 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, d);
  }

  vec3 tint(float e) {
    if (e >= uLoadLine) {
      float t = clamp((e - uLoadLine) / 1.4, 0.0, 1.0);
      return t < 0.5 ? mix(uLand1, uLand2, t / 0.5) : mix(uLand2, uLand3, (t - 0.5) / 0.5);
    }
    if (e >= 0.0) return uIntertidal;
    float d = -e;
    if (d < 0.18) return uWater1;
    if (d < 0.6) return mix(uWater1, uWater2, (d - 0.18) / 0.42);
    return mix(uWater2, uPaper, clamp((d - 0.6) / 0.9, 0.0, 1.0));
  }

  void main() {
    float e = vElev - uSeaLevel;
    vec3 col = tint(e);

    // Hillshade from the north-west, the cartographer's convention.
    vec3 light = normalize(vec3(-1.0, 1.35, -1.0));
    float shade = clamp(dot(normalize(vNormal), light), 0.0, 1.0);
    float land = step(0.0, e);
    col *= mix(1.0, 0.8 + 0.32 * shade, land);
    col *= mix(1.0, 0.94 + 0.08 * shade, 1.0 - land);

    // Graticule every 5 points of growth and margin.
    float g = mix(uExtent.x, uExtent.y, vUv.x) / 0.05;
    float m = mix(uExtent.z, uExtent.w, vUv.y) / 0.05;
    float grat = max(isoline(g, 1.0), isoline(m, 1.0));
    col = mix(col, uRule, grat * (uDark > 0.5 ? 0.35 : 0.55));

    // Contours on land every 0.1 (about 10% of value), index contour every 0.5.
    float c = isoline(e / 0.1, 1.0) * 0.5;
    float ci = isoline(e / 0.5, 1.6) * 0.9;
    col = mix(col, uLandLine, max(c, ci) * land);

    // Waterlining: lines parallel to the coast, spaced wider with depth.
    float depth = max(-e, 0.0);
    float k = pow(depth / 0.035, 1.0 / 1.45);
    float wl = isoline(k, 1.0) * (1.0 - land) * clamp(1.0 - (k - 1.0) * 0.11, 0.1, 0.85) * step(0.5, k);
    col = mix(col, uWaterLine, wl);

    // Load line (dashed in 2D, solid hairline here) and the coastline.
    float load = isoline((vElev - uSeaLevel - uLoadLine) / 1000.0 + 0.5, 1.0);
    col = mix(col, uIntertidalInk, load * step(0.005, uLoadLine) * 0.85);
    float coast = isoline(e / 1000.0 + 0.5, 3.2);
    col = mix(col, uInk, coast);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* Block sides: a cross-section of the terrain, ruled with draft marks. */
export const wallVertex = /* glsl */ `
  ${heightFn}
  attribute float aTop;
  uniform float uFloor;

  varying float vElev;
  varying float vY;

  void main() {
    ivec2 p = ivec2(round(uv * (uTexSize - 1.0)));
    float e = elevAt(p);
    vec3 pos = position;
    pos.y = aTop > 0.5 ? heightOf(e) : uFloor;
    vElev = aTop > 0.5 ? e : -9.0;
    vY = pos.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const wallFragment = /* glsl */ `
  uniform vec3 uFace;
  uniform vec3 uLine;
  uniform float uHeight;
  uniform float uSeaY;

  varying float vY;

  float isoline(float v, float w) {
    float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-5);
    return 1.0 - smoothstep(w * 0.5 - 0.5, w * 0.5 + 0.5, d);
  }

  void main() {
    float y = (vY - uSeaY) / max(uHeight, 1e-3);
    float strata = isoline(y / 0.1, 1.0) * 0.28;
    vec3 col = mix(uFace, uLine, strata);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* Water: nearly invisible from above, a glassy column from the side. */
export const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const waterFragment = /* glsl */ `
  uniform vec3 uWater;
  uniform vec3 uEdge;
  uniform float uSideAlpha;
  uniform float uTopAlpha;

  varying vec3 vWorld;
  varying vec3 vNormalW;

  void main() {
    vec3 view = normalize(cameraPosition - vWorld);
    float facing = abs(dot(view, normalize(vNormalW)));
    float top = step(0.5, vNormalW.y);
    // Fresnel: transparent when looked at straight on, reflective at grazing angles.
    float fres = pow(1.0 - facing, 3.0);
    float a = mix(uSideAlpha, uTopAlpha + fres * 0.45, top);
    vec3 col = mix(uWater, uEdge, top * fres * 0.5);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export const soundingVertex = /* glsl */ `
  attribute vec3 aColor;
  uniform float uSize;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const soundingFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = 1.0 - smoothstep(0.38, 0.5, r);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(vColor, a * 0.85);
    #include <colorspace_fragment>
  }
`;
