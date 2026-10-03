/* Browser half of scripts/typography/verify.mjs: reference ink maps and candidate scoring. */
(() => {
  const work = document.createElement('canvas');
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const meas = document.createElement('canvas').getContext('2d');
  const images = new Map();
  const refs = new Map();

  // ---------- Reference ink maps ----------

  async function image(name) {
    if (!images.has(name)) {
      const img = new Image();
      img.src = `/image/${name}`;
      await img.decode();
      images.set(name, img);
    }
    return images.get(name);
  }

  function percentile(values, p) {
    const sorted = Float32Array.from(values).sort();
    const k = ((sorted.length - 1) * p) / 100;
    const f = Math.floor(k);
    const c = Math.ceil(k);
    return sorted[f] + (sorted[c] - sorted[f]) * (k - f);
  }

  // Ink 0..1 against the local background: dark text on paper, or light text on charcoal.
  function inkMap(img, [x0, y0, x1, y1], polarity) {
    const w = x1 - x0;
    const h = y1 - y0;
    work.width = w;
    work.height = h;
    wctx.drawImage(img, x0, y0, w, h, 0, 0, w, h);
    const data = wctx.getImageData(0, 0, w, h).data;
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++)
      lum[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    const ink = new Float32Array(w * h);
    if (polarity === 'dark') {
      const bg = percentile(lum, 90);
      const k = percentile(lum, 1.5);
      for (let i = 0; i < ink.length; i++)
        ink[i] = Math.min(1, Math.max(0, (bg - lum[i]) / Math.max(bg - k, 1)));
    } else {
      const bg = percentile(lum, 10);
      const k = percentile(lum, 98.5);
      for (let i = 0; i < ink.length; i++)
        ink[i] = Math.min(1, Math.max(0, (lum[i] - bg) / Math.max(k - bg, 1)));
    }
    return { ink, w, h };
  }

  // Two-line headlines overlap ("Today's" descends into "picks."): keep the connected components
  // whose centroid lies on the requested side of the split.
  function keepLine(map, region, line, split, erase) {
    const { ink, w, h } = map;
    const label = new Int32Array(w * h);
    const keep = new Uint8Array(w * h);
    let next = 0;
    for (let start = 0; start < w * h; start++) {
      if (ink[start] <= 0.25 || label[start]) continue;
      next++;
      const queue = [start];
      label[start] = next;
      const members = [];
      let sumY = 0;
      while (queue.length) {
        const i = queue.pop();
        members.push(i);
        sumY += Math.floor(i / w);
        const x = i % w;
        const y = Math.floor(i / w);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (ink[j] > 0.25 && !label[j]) {
              label[j] = next;
              queue.push(j);
            }
          }
      }
      const centroid = sumY / members.length + region[1];
      if ((line === 'top') === centroid < split) for (const i of members) keep[i] = 1;
    }
    for (let i = 0; i < ink.length; i++) if (!keep[i]) ink[i] = 0;
    if (erase)
      for (let y = Math.max(erase[1] - region[1], 0); y < Math.min(erase[3] - region[1], h); y++)
        for (let x = Math.max(erase[0] - region[0], 0); x < Math.min(erase[2] - region[0], w); x++)
          ink[y * w + x] = 0;
    // Crop to the kept ink with a 3 px margin.
    const box = bbox(ink, w, h);
    const cx0 = Math.max(box.x0 - 3, 0);
    const cy0 = Math.max(box.y0 - 3, 0);
    const cw = Math.min(box.x1 + 4, w) - cx0;
    const ch = Math.min(box.y1 + 4, h) - cy0;
    const cropped = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) cropped[y * cw + x] = ink[(y + cy0) * w + x + cx0];
    return { ink: cropped, w: cw, h: ch };
  }

  async function reference(sample) {
    if (refs.has(sample.id)) return refs.get(sample.id);
    const img = await image(sample.image);
    let map = inkMap(img, sample.region ?? sample.box, sample.polarity);
    if (sample.line) map = keepLine(map, sample.region, sample.line, sample.split, sample.erase);
    const box = bbox(map.ink, map.w, map.h);
    const ref = { ...map, inkBox: [box.x0, box.y0, box.x1, box.y1] };
    refs.set(sample.id, ref);
    return ref;
  }

  // ---------- Candidate rendering and scoring ----------

  function render(text, family, weight, size, spacing, w, h, x, baseline) {
    work.width = w;
    work.height = h;
    wctx.fillStyle = '#fff';
    wctx.fillRect(0, 0, w, h);
    wctx.fillStyle = '#000';
    wctx.font = `${weight} ${size}px "${family}"`;
    wctx.fontKerning = 'normal';
    wctx.letterSpacing = `${spacing}px`;
    wctx.textBaseline = 'alphabetic';
    wctx.fillText(text, x, baseline);
    const data = wctx.getImageData(0, 0, w, h).data;
    const ink = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) ink[i] = 1 - data[i * 4 + 1] / 255;
    return ink;
  }

  function bbox(ink, w, h, t = 0.5) {
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (ink[y * w + x] > t) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // The photographs are soft; a 1-2-1 blur brings the crisp render to a comparable edge.
  function blur(ink, w, h) {
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        tmp[i] =
          0.5 * ink[i] + 0.25 * (x > 0 ? ink[i - 1] : 0) + 0.25 * (x < w - 1 ? ink[i + 1] : 0);
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        out[i] =
          0.5 * tmp[i] + 0.25 * (y > 0 ? tmp[i - w] : 0) + 0.25 * (y < h - 1 ? tmp[i + w] : 0);
      }
    return out;
  }

  function place(source, sw, sh, rw, rh, ox, oy) {
    const out = new Float32Array(rw * rh);
    for (let y = 0; y < rh; y++) {
      const sy = y - oy;
      if (sy < 0 || sy >= sh) continue;
      for (let x = 0; x < rw; x++) {
        const sx = x - ox;
        if (sx >= 0 && sx < sw) out[y * rw + x] = source[sy * sw + sx];
      }
    }
    return out;
  }

  function scores(R, P) {
    let inter = 0;
    let sr = 0;
    let sp = 0;
    for (let i = 0; i < R.length; i++) {
      inter += Math.min(R[i], P[i]);
      sr += R[i];
      sp += P[i];
    }
    return { dice: (2 * inter) / (sr + sp || 1) };
  }

  function fitAt(text, ref, cand, size) {
    const rb = ref.inkBox;
    const wr = rb[2] - rb[0] + 1;
    const chars = [...text];
    const cw = Math.ceil(size * chars.length * 1.3 + wr + 200);
    const ch = Math.ceil(size * 2.2 + 40);
    const base = Math.round(size * 1.4 + 10);
    let ink = render(text, cand.family, cand.weight, size, 0, cw, ch, 40, base);
    const bn = bbox(ink, cw, ch);
    if (!bn) return null;
    const gaps = Math.max(chars.length - 1, 1);
    const tracking = Math.max(-0.25 * size, Math.min(0.25 * size, (wr - bn.w) / gaps));
    ink = blur(render(text, cand.family, cand.weight, size, tracking, cw, ch, 40, base), cw, ch);
    const bt = bbox(ink, cw, ch);
    if (!bt) return null;
    let best = { dice: -1 };
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const P = place(ink, cw, ch, ref.w, ref.h, rb[0] - bt.x0 + dx, rb[1] - bt.y0 + dy);
        const sc = scores(ref.ink, P);
        if (sc.dice > best.dice) best = { ...sc, dx, dy };
      }
    return {
      size,
      tracking,
      bn,
      cw,
      ch,
      base,
      best,
      ox: rb[0] - bt.x0 + best.dx,
      oy: rb[1] - bt.y0 + best.dy,
    };
  }

  function heightFit(text, ref, cand) {
    const rb = ref.inkBox;
    const probe = 200;
    const pw = Math.ceil(probe * [...text].length * 1.3) + 400;
    const b200 = bbox(render(text, cand.family, cand.weight, probe, 0, pw, 520, 100, 360), pw, 520);
    if (!b200) return null;
    const size0 = (probe * (rb[3] - rb[1] + 1)) / b200.h;
    let fit = null;
    for (let k = 0.86; k <= 1.141; k += 0.02) {
      const f = fitAt(text, ref, cand, size0 * k);
      if (f && (!fit || f.best.dice > fit.best.dice)) fit = f;
    }
    return fit && { fit, size0 };
  }

  function evaluate(sample, ref, cand) {
    const fitted = heightFit(sample.text, ref, cand);
    if (!fitted) return null;
    const { fit, size0 } = fitted;
    const { size, tracking, cw, ch, base, ox, oy } = fit;
    const chars = [...sample.text];
    // Elastic: glyph positions from the tracked layout, then each glyph may move a little.
    meas.font = `${cand.weight} ${size}px "${cand.family}"`;
    meas.fontKerning = 'normal';
    meas.letterSpacing = `${tracking}px`;
    const xs = [];
    let prefix = '';
    for (const c of chars) {
      xs.push(40 + meas.measureText(prefix + c).width - meas.measureText(c).width);
      prefix += c;
    }
    const r = Math.max(2, Math.round(0.07 * size));
    const glyphs = [];
    chars.forEach((c, i) => {
      if (!c.trim()) return;
      const g = blur(render(c, cand.family, cand.weight, size, 0, cw, ch, xs[i], base), cw, ch);
      glyphs.push({ g, mass: g.reduce((total, v) => total + v, 0) });
    });
    glyphs.sort((a, b) => b.mass - a.mass);
    const comp = new Float32Array(ref.w * ref.h);
    for (const { g } of glyphs) {
      let best = { gain: -Infinity, P: null };
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const P = place(g, cw, ch, ref.w, ref.h, ox + dx, oy + dy);
          let gain = 0;
          for (let j = 0; j < P.length; j++) {
            if (!P[j]) continue;
            gain +=
              Math.min(Math.max(ref.ink[j] - comp[j], 0), P[j]) -
              0.5 * Math.max(P[j] - ref.ink[j], 0);
          }
          if (gain > best.gain) best = { gain, P };
        }
      for (let j = 0; j < comp.length; j++) comp[j] = Math.max(comp[j], best.P[j]);
    }
    // Ink mass at the height-derived size: a weight estimate independent of image softness.
    const f0 = fitAt(sample.text, ref, cand, size0);
    const P0 = place(
      blur(
        render(
          sample.text,
          cand.family,
          cand.weight,
          f0.size,
          f0.tracking,
          f0.cw,
          f0.ch,
          40,
          f0.base,
        ),
        f0.cw,
        f0.ch,
      ),
      f0.cw,
      f0.ch,
      ref.w,
      ref.h,
      f0.ox,
      f0.oy,
    );
    let massP = 0;
    let massR = 0;
    for (let j = 0; j < ref.ink.length; j++) {
      massP += P0[j];
      massR += ref.ink[j];
    }
    return {
      massRatio: +(massP / massR).toFixed(4),
      rigid: +fit.best.dice.toFixed(4),
      elastic: +scores(ref.ink, comp).dice.toFixed(4),
      size: +size.toFixed(2),
      trackingEm: +(tracking / size).toFixed(4),
      widthRatio: +(fit.bn.w / (ref.inkBox[2] - ref.inkBox[0] + 1)).toFixed(4),
    };
  }

  async function loadFace(cand) {
    const face = new FontFace(
      cand.family,
      `url(${cand.url})`,
      cand.variable ? { weight: '1 1000' } : { weight: String(cand.weight) },
    );
    await face.load();
    document.fonts.add(face);
    return face;
  }

  let samplesById = new Map();

  window.verifyAll = async (samples, candidates) => {
    samplesById = new Map(samples.map((sample) => [sample.id, sample]));
    const refsOut = {};
    for (const sample of samples) {
      const ref = await reference(sample);
      refsOut[sample.id] = { w: ref.w, h: ref.h, inkBox: ref.inkBox };
    }
    const results = {};
    for (const cand of candidates) {
      const face = await loadFace(cand);
      results[cand.id] = {};
      for (const sample of samples) {
        if (sample.role !== cand.role) continue;
        results[cand.id][sample.id] = evaluate(sample, await reference(sample), cand);
      }
      document.fonts.delete(face);
    }
    return { samples: refsOut, results };
  };

  // Reference | fitted candidate | overlay (shared ink black, reference only red, candidate cyan).
  window.overlay = async (sampleId, cand, scale = 2) => {
    const sample = samplesById.get(sampleId);
    const ref = await reference(sample);
    const face = await loadFace(cand);
    const { fit } = heightFit(sample.text, ref, cand);
    const P = place(
      render(
        sample.text,
        cand.family,
        cand.weight,
        fit.size,
        fit.tracking,
        fit.cw,
        fit.ch,
        40,
        fit.base,
      ),
      fit.cw,
      fit.ch,
      ref.w,
      ref.h,
      fit.ox,
      fit.oy,
    );
    document.fonts.delete(face);
    const { w, h } = ref;
    const img = new ImageData(w, h * 3 + 8);
    const put = (row, x, y, r, g, b) => {
      const j = ((row * (h + 4) + y) * w + x) * 4;
      img.data[j] = r;
      img.data[j + 1] = g;
      img.data[j + 2] = b;
      img.data[j + 3] = 255;
    };
    for (let y = 0; y < h + 4; y++)
      for (let x = 0; x < w; x++) {
        if (y >= h) {
          put(0, x, y, 160, 160, 160);
          put(1, x, y, 160, 160, 160);
          continue;
        }
        const r = ref.ink[y * w + x];
        const p = P[y * w + x];
        put(0, x, y, 255 * (1 - r), 255 * (1 - r), 255 * (1 - r));
        put(1, x, y, 255 * (1 - p), 255 * (1 - p), 255 * (1 - p));
        put(2, x, y, 255 * (1 - p), 255 * (1 - r), 255 * (1 - r));
      }
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h * 3 + 8;
    tmp.getContext('2d').putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    out.width = w * scale;
    out.height = (h * 3 + 8) * scale;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = false;
    o.drawImage(tmp, 0, 0, out.width, out.height);
    return { url: out.toDataURL('image/png'), size: fit.size, tracking: fit.tracking / fit.size };
  };
})();
