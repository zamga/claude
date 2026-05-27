/* =====================================================================
   MERIDIAN — hero WebGL distortion (progressive enhancement)
   Renders [data-hero-distortion] > img through a displacement shader.
   Degrades silently to the static image on any failure, on reduced
   motion, or where WebGL is unavailable. Pauses when offscreen/hidden.
   ===================================================================== */
(function () {
  "use strict";

  var root = document.querySelector("[data-hero-distortion]");
  if (!root) return;
  var img = root.querySelector("img");
  if (!img) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  function start() {
    var canvas = document.createElement("canvas");
    var gl;
    try {
      gl = canvas.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false })
        || canvas.getContext("experimental-webgl");
    } catch (e) { gl = null; }
    if (!gl) return; // keep static <img> fallback

    var VERT = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
    var FRAG = [
      "precision mediump float;",
      "uniform sampler2D uTex;uniform float uTime;uniform vec2 uMouse;uniform vec2 uRatio;",
      "varying vec2 vUv;",
      "void main(){",
      "  vec2 uv = vUv*uRatio + (1.0-uRatio)*0.5;", // cover-fit
      "  float t = uTime;",
      "  vec2 d = vec2(sin(uv.y*8.0+t*0.6)*0.006 + sin(uv.y*3.0-t*0.4)*0.010,",
      "                cos(uv.x*8.0+t*0.5)*0.006);",
      "  float dist = distance(uv, uMouse);",
      "  float ripple = sin(dist*28.0 - t*3.0) * 0.014 * smoothstep(0.45,0.0,dist);",
      "  d += normalize(uv - uMouse + 0.0001) * ripple;",
      "  vec3 col = texture2D(uTex, clamp(uv+d,0.0,1.0)).rgb;",
      "  float g = dot(col, vec3(0.299,0.587,0.114));",
      "  vec3 graded = mix(vec3(0.105,0.129,0.137), vec3(g), 0.55);",
      "  graded += vec3(0.40,0.91,0.98) * clamp(length(d)*18.0,0.0,1.0) * 0.12;",
      "  gl_FragColor = vec4(graded, 1.0);",
      "}"
    ].join("\n");

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }

    var prog, loc = {}, tex, raf = 0, running = false, startT = 0;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      var pLoc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(pLoc);
      gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

      loc.time = gl.getUniformLocation(prog, "uTime");
      loc.mouse = gl.getUniformLocation(prog, "uMouse");
      loc.ratio = gl.getUniformLocation(prog, "uRatio");

      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (e) {
      return; // shader/texture failed -> static fallback remains
    }

    canvas.className = "hero__distortion-canvas";
    root.appendChild(canvas);
    img.style.opacity = "0"; // canvas now provides the visual

    var mouse = { x: 0.5, y: 0.5 };
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      var tw = img.naturalWidth || 1200, th = img.naturalHeight || 900;
      var cA = canvas.width / canvas.height, tA = tw / th;
      gl.uniform2f(loc.ratio, Math.min(cA / tA, 1), Math.min((1 / cA) / (1 / tA), 1));
    }

    function frame(now) {
      if (!running) return;
      if (!startT) startT = now;
      gl.uniform1f(loc.time, (now - startT) / 1000);
      gl.uniform2f(loc.mouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = window.requestAnimationFrame(frame);
    }
    function play() { if (!running) { running = true; raf = window.requestAnimationFrame(frame); } }
    function stop() { running = false; if (raf) window.cancelAnimationFrame(raf); raf = 0; }

    root.addEventListener("pointermove", function (e) {
      var r = root.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = 1 - (e.clientY - r.top) / r.height;
    }, { passive: true });

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else play();
    });

    // Only animate while the hero is on screen.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.isIntersecting ? play() : stop(); });
      }, { threshold: 0 }).observe(root);
    }

    resize();
    play();
  }

  // Defer init until idle so it never blocks first paint / hurts TBT.
  function boot() {
    if (img.complete && img.naturalWidth) {
      (window.requestIdleCallback || window.setTimeout)(start, 1);
    } else {
      img.addEventListener("load", function () {
        (window.requestIdleCallback || window.setTimeout)(start, 1);
      }, { once: true });
      img.addEventListener("error", function () {}, { once: true });
    }
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
