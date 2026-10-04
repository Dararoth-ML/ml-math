// Interactive figures. Each V.name(box) builds its controls and returns a draw()
// that reruns on any input inside the box. Figures start when scrolled into view.
const V = {};
const C = { blue: '#1f5fbf', red: '#c0392b', green: '#2e8b57', orange: '#d4800f', purple: '#7b3fa0', gray: '#888', ink: '#111', light: '#ddd' };
const PAL = [C.blue, C.red, C.green, C.orange, C.purple];
const DPR = Math.min(2, window.devicePixelRatio || 1);
const FONT = "14px 'Times New Roman', Times, serif";

function el(tag, props, parent) {
  const e = document.createElement(tag);
  Object.assign(e, props || {});
  if (parent) parent.appendChild(e);
  return e;
}
function canvas(box, w = 600, h = 320) {
  const cv = el('canvas', { width: w * DPR, height: h * DPR }, box);
  const ctx = cv.getContext('2d');
  ctx.scale(DPR, DPR);
  ctx.font = FONT;
  return { cv, ctx, w, h };
}
function row(box) { return el('div', { className: 'ctl' }, box); }
function slider(box, label, min, max, step, val, fmt) {
  const r = box.classList && box.classList.contains('ctl') ? box : row(box);
  const l = el('label', {}, r);
  l.append(label + ' ');
  const i = el('input', { type: 'range', min, max, step, value: val }, l);
  const s = el('span', { className: 'val' }, l);
  const show = () => (s.textContent = fmt ? fmt(+i.value) : i.value);
  i.addEventListener('input', show);
  show();
  return { get v() { return +i.value; }, set v(x) { i.value = x; show(); }, i };
}
function button(box, label, onclick) {
  const r = box.classList && box.classList.contains('ctl') ? box : row(box);
  const b = el('button', { type: 'button', textContent: label }, r);
  b.addEventListener('click', () => { onclick(); const d = closestBox(b); if (d && d.draw) d.draw(); });
  return b;
}
function select(box, label, opts, val) {
  const r = box.classList && box.classList.contains('ctl') ? box : row(box);
  const l = el('label', {}, r);
  l.append(label + ' ');
  const s = el('select', {}, l);
  opts.forEach(o => el('option', { value: o, textContent: o }, s));
  if (val) s.value = val;
  return { get v() { return s.value; }, i: s };
}
function check(box, label, val) {
  const r = box.classList && box.classList.contains('ctl') ? box : row(box);
  const l = el('label', {}, r);
  const i = el('input', { type: 'checkbox', checked: !!val }, l);
  l.append(' ' + label);
  return { get v() { return i.checked; }, i };
}
function out(box) { return el('div', { className: 'out' }, box); }
function closestBox(n) { while (n && !(n.classList && n.classList.contains('viz'))) n = n.parentNode; return n; }
const f2 = x => (Math.abs(x) >= 1e4 || (Math.abs(x) < 1e-3 && x !== 0) ? x.toExponential(2) : (+x.toFixed(3)).toString());

// Maps data coordinates onto a canvas and draws common marks.
function plot(c, x0, x1, y0, y1, pad = 28) {
  const { ctx, w, h } = c;
  const P = {
    c, ctx, x0, x1, y0, y1,
    X: x => pad + (x - P.x0) / (P.x1 - P.x0) * (w - 2 * pad),
    Y: y => h - pad - (y - P.y0) / (P.y1 - P.y0) * (h - 2 * pad),
    ix: px => P.x0 + (px - pad) / (w - 2 * pad) * (P.x1 - P.x0),
    iy: py => P.y0 + (h - pad - py) / (h - 2 * pad) * (P.y1 - P.y0),
    clear() { ctx.clearRect(0, 0, w, h); },
    axes(grid = true) {
      ctx.lineWidth = 1;
      const step = (a, b) => { const r = (b - a) / 8, p = Math.pow(10, Math.floor(Math.log10(r))); return [1, 2, 5, 10].map(m => m * p).find(s => s >= r); };
      const sx = step(P.x0, P.x1), sy = step(P.y0, P.y1);
      ctx.fillStyle = C.gray; ctx.font = '12px Times New Roman';
      for (let x = Math.ceil(P.x0 / sx) * sx; x <= P.x1 + 1e-9; x += sx) {
        if (grid) P.seg(x, P.y0, x, P.y1, '#f0f0f0');
        ctx.textAlign = 'center'; ctx.fillText(+x.toFixed(6), P.X(x), Math.min(h - 6, Math.max(12, P.Y(0) + 14)));
      }
      for (let y = Math.ceil(P.y0 / sy) * sy; y <= P.y1 + 1e-9; y += sy) {
        if (grid) P.seg(P.x0, y, P.x1, y, '#f0f0f0');
        ctx.textAlign = 'right'; if (Math.abs(y) > 1e-9) ctx.fillText(+y.toFixed(6), Math.max(24, Math.min(w - 4, P.X(0) - 4)), P.Y(y) + 4);
      }
      if (P.y0 <= 0 && P.y1 >= 0) P.seg(P.x0, 0, P.x1, 0, '#999');
      if (P.x0 <= 0 && P.x1 >= 0) P.seg(0, P.y0, 0, P.y1, '#999');
      ctx.font = FONT;
    },
    seg(a, b, cc, d, col = C.ink, lw = 1, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(P.X(a), P.Y(b)); ctx.lineTo(P.X(cc), P.Y(d)); ctx.stroke(); ctx.setLineDash([]);
    },
    fn(f, col = C.blue, lw = 2, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 400; i++) {
        const x = P.x0 + (P.x1 - P.x0) * i / 400, y = f(x);
        if (!isFinite(y) || Math.abs(y) > 1e6) { pen = false; continue; }
        pen ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y)); pen = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
    },
    path(pts, col = C.blue, lw = 2, close, fill) {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(P.X(x), P.Y(y)) : ctx.moveTo(P.X(x), P.Y(y))));
      if (close) ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (col) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); }
    },
    dot(x, y, r = 4, col = C.ink, ring) {
      ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), r, 0, 7);
      if (ring) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); }
    },
    arrow(a, b, cc, d, col = C.ink, lw = 2) {
      const X1 = P.X(a), Y1 = P.Y(b), X2 = P.X(cc), Y2 = P.Y(d), t = Math.atan2(Y2 - Y1, X2 - X1);
      ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(X1, Y1); ctx.lineTo(X2, Y2); ctx.stroke();
      if (Math.hypot(X2 - X1, Y2 - Y1) < 2) return;
      ctx.beginPath(); ctx.moveTo(X2, Y2);
      ctx.lineTo(X2 - 10 * Math.cos(t - 0.4), Y2 - 10 * Math.sin(t - 0.4));
      ctx.lineTo(X2 - 10 * Math.cos(t + 0.4), Y2 - 10 * Math.sin(t + 0.4)); ctx.fill();
    },
    text(s, x, y, col = C.ink, align = 'left', dx = 0, dy = 0) {
      ctx.fillStyle = col; ctx.textAlign = align; ctx.fillText(s, P.X(x) + dx, P.Y(y) + dy);
    },
    rect(x, y, x2, y2, fill, stroke) {
      const a = P.X(x), b = P.Y(y2), ww = P.X(x2) - a, hh = P.Y(y) - b;
      if (fill) { ctx.fillStyle = fill; ctx.fillRect(a, b, ww, hh); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.strokeRect(a, b, ww, hh); }
    },
  };
  return P;
}

// Draggable handles: pts are objects with x, y in data units. move(p) may clamp p.
function drag(P, pts, move) {
  const cv = P.c.cv;
  let hold = null;
  const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * P.c.w / r.width, (e.clientY - r.top) * P.c.h / r.height]; };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => {
    const [px, py] = at(e);
    let best = 18;
    pts.forEach(p => { const d = Math.hypot(P.X(p.x) - px, P.Y(p.y) - py); if (d < best) { best = d; hold = p; } });
    if (hold) cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!hold) return;
    const [px, py] = at(e);
    hold.x = P.ix(px); hold.y = P.iy(py);
    if (move) move(hold);
    closestBox(cv).draw();
  });
  cv.addEventListener('pointerup', () => (hold = null));
}
// Click position in data units, for figures that add points on click.
function onClick(P, f) {
  P.c.cv.addEventListener('click', e => {
    const r = P.c.cv.getBoundingClientRect();
    f(P.ix((e.clientX - r.left) * P.c.w / r.width), P.iy((e.clientY - r.top) * P.c.h / r.height), e);
    closestBox(P.c.cv).draw();
  });
}
// Runs f(dt) every frame while the figure is on screen.
function loop(box, f) {
  let last = performance.now();
  const t = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (box.vis) f(dt); requestAnimationFrame(t); };
  requestAnimationFrame(t);
}
// Seeded random numbers so figures look the same on each load.
function rng(seed = 1) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()); }
const sigmoid = z => 1 / (1 + Math.exp(-z));
const range = n => Array.from({ length: n }, (_, i) => i);
const sum = a => a.reduce((s, x) => s + x, 0);

function start() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    const b = e.target;
    b.vis = e.isIntersecting;
    if (!b.vis || b.done) return;
    b.done = true;
    try {
      const d = V[b.dataset.viz](b);
      if (d) { b.draw = d; b.addEventListener('input', d); b.addEventListener('change', d); d(); }
    } catch (err) { el('p', { className: 'err', textContent: 'Figure failed: ' + err.message }, b); console.error(b.dataset.viz, err); }
  }), { rootMargin: '300px' });
  document.querySelectorAll('.viz').forEach(b => io.observe(b));
}
document.addEventListener('DOMContentLoaded', start);

/* ---------- Part I, chapters 1 and 2 ---------- */
V.functions = box => {
  const c = canvas(box), P = plot(c, -4, 4, -3, 9);
  const r = row(box), a = slider(r, 'a', -3, 3, 0.1, 2), b = slider(r, 'b', -3, 3, 0.1, 1);
  const r2 = row(box), fg = check(r2, 'show f(g(x))', true), gf = check(r2, 'show g(f(x))', false);
  const o = out(box);
  return () => {
    const f = x => a.v * x + b.v, g = x => x * x;
    P.clear(); P.axes();
    P.fn(g, C.gray, 1.5, [5, 4]); P.fn(f, C.blue);
    if (fg.v) P.fn(x => f(g(x)), C.red);
    if (gf.v) P.fn(x => g(f(x)), C.green);
    o.innerHTML = `<span style="color:${C.blue}">f(x) = ${a.v}x + ${b.v}</span>, <span style="color:${C.gray}">g(x) = x²</span>` +
      (fg.v ? `, <span style="color:${C.red}">f(g(x)) = ${a.v}x² + ${b.v}</span>` : '') +
      (gf.v ? `, <span style="color:${C.green}">g(f(x)) = (${a.v}x + ${b.v})²</span>` : '');
  };
};

V.explog = box => {
  const c = canvas(box), P = plot(c, -3, 6, -3, 6);
  const r = row(box), b = slider(r, 'base b', 0.2, 4, 0.05, 2), x0 = slider(r, 'x₀', -2, 2.5, 0.05, 1);
  const o = out(box);
  return () => {
    const B = Math.abs(b.v - 1) < 0.04 ? 1.04 : b.v; // base 1 has no logarithm
    P.clear(); P.axes();
    P.fn(x => x, C.gray, 1, [5, 4]);
    P.fn(x => Math.pow(B, x), C.blue);
    P.fn(x => (x > 0 ? Math.log(x) / Math.log(B) : NaN), C.red);
    const y = Math.pow(B, x0.v);
    P.seg(x0.v, y, y, x0.v, C.gray, 1, [3, 3]);
    P.dot(x0.v, y, 5, C.blue); P.dot(y, x0.v, 5, C.red);
    o.innerHTML = `<span style="color:${C.blue}">b<sup>x₀</sup> = ${f2(B)}<sup>${x0.v}</sup> = ${f2(y)}</span> and <span style="color:${C.red}">log<sub>b</sub>(${f2(y)}) = ${x0.v}</span>. ` +
      (B < 1 ? 'With b &lt; 1 the exponential decays and the log decreases.' : 'With b &gt; 1 both curves increase.');
  };
};

V.sigma = box => {
  const c = canvas(box, 600, 230), P = plot(c, -0.3, 10.3, -0.3, 3.2);
  const pts = [1.5, 2.5, 4, 6.5, 8].map(x => ({ x, y: 1 }));
  drag(P, pts, p => { p.y = 1; p.x = Math.max(0, Math.min(10, p.x)); });
  const r = row(box);
  button(r, 'Add weight', () => pts.length < 12 && pts.push({ x: 1 + 8 * Math.random(), y: 1 }));
  button(r, 'Remove weight', () => pts.length > 1 && pts.pop());
  const o = out(box);
  return () => {
    const n = pts.length, m = sum(pts.map(p => p.x)) / n;
    P.clear();
    P.seg(0, 0.6, 10, 0.6, C.ink, 3);
    for (let x = 0; x <= 10; x++) { P.seg(x, 0.6, x, 0.45, C.ink); P.text(String(x), x, 0.15, C.gray, 'center'); }
    P.path([[m, 0.6], [m - 0.22, 0.25], [m + 0.22, 0.25]], C.ink, 1, true, C.orange);
    pts.forEach((p, i) => {
      const y = 1.45 + 0.13 * i, d = p.x - m;
      P.arrow(m, y, p.x, y, d >= 0 ? C.blue : C.red, 1.5);
      P.seg(p.x, 1, p.x, y, '#ccc', 1);
      P.dot(p.x, 1, 8, C.ink);
    });
    P.seg(m, 0.6, m, 3.1, C.orange, 1, [4, 4]);
    o.innerHTML = `n = ${n}, &nbsp; Σxᵢ = ${f2(sum(pts.map(p => p.x)))}, &nbsp; x̄ = Σxᵢ / n = <b>${f2(m)}</b>, &nbsp; Σ(xᵢ − x̄) = ${f2(Math.abs(sum(pts.map(p => p.x - m))) < 1e-9 ? 0 : sum(pts.map(p => p.x - m)))}`;
  };
};

V.vectors = box => {
  const c = canvas(box, 600, 400), P = plot(c, -6.33, 6.33, -4, 4);
  const u = { x: 2, y: 1 }, v = { x: 1, y: 2.5 };
  drag(P, [u, v]);
  const r = row(box), k = slider(r, 'c', -2, 2, 0.1, 1.5);
  const o = out(box);
  return () => {
    const s = { x: u.x + v.x, y: u.y + v.y };
    P.clear(); P.axes();
    P.path([[0, 0], [u.x, u.y], [s.x, s.y], [v.x, v.y]], null, 1, true, 'rgba(123,63,160,0.07)');
    P.seg(u.x, u.y, s.x, s.y, C.red, 1, [4, 4]); P.seg(v.x, v.y, s.x, s.y, C.blue, 1, [4, 4]);
    c.ctx.globalAlpha = 0.5; P.arrow(0, 0, k.v * u.x, k.v * u.y, C.green, 7); c.ctx.globalAlpha = 1;
    P.arrow(0, 0, s.x, s.y, C.purple); P.arrow(0, 0, u.x, u.y, C.blue); P.arrow(0, 0, v.x, v.y, C.red);
    P.text('u', u.x, u.y, C.blue, 'left', 6, -6); P.text('v', v.x, v.y, C.red, 'left', 6, -6); P.text('u + v', s.x, s.y, C.purple, 'left', 6, -6);
    const p = q => `(${f2(q.x)}, ${f2(q.y)})`;
    o.innerHTML = `<span style="color:${C.blue}">u = ${p(u)}</span>, <span style="color:${C.red}">v = ${p(v)}</span>, <span style="color:${C.purple}">u + v = ${p(s)}</span>, <span style="color:${C.green}">${k.v}·u = ${p({ x: k.v * u.x, y: k.v * u.y })}</span>`;
  };
};

V.dot = box => {
  const c = canvas(box, 600, 400), P = plot(c, -6.33, 6.33, -4, 4);
  const u = { x: 3, y: 1 }, v = { x: 1.5, y: 2.5 };
  drag(P, [u, v]);
  const o = out(box);
  return () => {
    const d = u.x * v.x + u.y * v.y, nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y), t = d / (nu * nu || 1);
    const cs = d / (nu * nv || 1), ang = Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI;
    P.clear(); P.axes();
    P.seg(-8 * u.x, -8 * u.y, 8 * u.x, 8 * u.y, '#ddd', 1);
    P.seg(v.x, v.y, t * u.x, t * u.y, C.gray, 1, [4, 4]);
    P.arrow(0, 0, t * u.x, t * u.y, C.green, 6);
    const { ctx } = c, a1 = -Math.atan2(u.y, u.x), a2 = -Math.atan2(v.y, v.x);
    let df = a2 - a1; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(P.X(0), P.Y(0), 28, a1, a1 + df, df < 0); ctx.stroke();
    P.arrow(0, 0, u.x, u.y, C.blue); P.arrow(0, 0, v.x, v.y, C.red);
    P.text('u', u.x, u.y, C.blue, 'left', 6, -6); P.text('v', v.x, v.y, C.red, 'left', 6, -6);
    o.innerHTML = `u·v = ${f2(u.x)}·${f2(v.x)} + ${f2(u.y)}·${f2(v.y)} = <b>${f2(d)}</b> &nbsp; ‖u‖ = ${f2(nu)}, ‖v‖ = ${f2(nv)} &nbsp; cos θ = ${f2(cs)}, θ = ${ang.toFixed(1)}°` +
      `<br><span style="color:${C.green}">projection of v onto u = ${f2(t)}·u</span>` + (Math.abs(cs) < 0.02 ? ' &nbsp; <b>orthogonal</b>' : '');
  };
};

V.norms = box => {
  const c = canvas(box, 600, 400), P = plot(c, -2.53, 2.53, -1.6, 1.6);
  const x = { x: 0.9, y: 0.5 };
  drag(P, [x]);
  const r = row(box), p = slider(r, 'p', 0.5, 10, 0.1, 1, v => (v >= 10 ? '∞' : v));
  const o = out(box);
  const norm = (a, b, q) => (q >= 10 ? Math.max(Math.abs(a), Math.abs(b)) : Math.pow(Math.pow(Math.abs(a), q) + Math.pow(Math.abs(b), q), 1 / q));
  const ball = (q, col, lw) => P.path(range(361).map(i => { const t = i * Math.PI / 180, a = Math.cos(t), b = Math.sin(t), n = norm(a, b, q); return [a / n, b / n]; }), col, lw, true);
  return () => {
    P.clear(); P.axes();
    c.ctx.setLineDash([4, 4]); ball(1, '#bbb', 1); ball(2, '#bbb', 1); ball(10, '#bbb', 1); c.ctx.setLineDash([]);
    ball(p.v, C.blue, 2.5);
    P.dot(x.x, x.y, 6, C.ink);
    const q = p.v >= 10 ? '∞' : p.v;
    o.innerHTML = `x = (${f2(x.x)}, ${f2(x.y)}) &nbsp; ‖x‖₁ = ${f2(norm(x.x, x.y, 1))}, ‖x‖₂ = ${f2(norm(x.x, x.y, 2))}, ‖x‖<sub>∞</sub> = ${f2(norm(x.x, x.y, 10))}, <b>‖x‖<sub>${q}</sub> = ${f2(norm(x.x, x.y, p.v))}</b>` +
      (p.v < 1 ? ' &nbsp; (p &lt; 1: not a norm, the ball is not convex)' : '');
  };
};

V.matrix = box => {
  const c = canvas(box, 600, 400), P = plot(c, -6.33, 6.33, -4, 4);
  const r = row(box), a = slider(r, 'a', -2, 2, 0.1, 1), b = slider(r, 'b', -2, 2, 0.1, 0.5);
  const r1 = row(box), cc = slider(r1, 'c', -2, 2, 0.1, 0), d = slider(r1, 'd', -2, 2, 0.1, 1);
  const set = (A, B, Cc, D) => { a.v = A; b.v = B; cc.v = Cc; d.v = D; };
  const r2 = row(box);
  button(r2, 'Identity', () => set(1, 0, 0, 1));
  button(r2, 'Rotate 30°', () => set(0.9, -0.5, 0.5, 0.9));
  button(r2, 'Shear', () => set(1, 1, 0, 1));
  button(r2, 'Mirror', () => set(-1, 0, 0, 1));
  button(r2, 'Squash', () => set(1, 2, 0.5, 1));
  const o = out(box);
  return () => {
    const M = (x, y) => [a.v * x + b.v * y, cc.v * x + d.v * y], det = a.v * d.v - b.v * cc.v;
    P.clear(); P.axes(false);
    for (let i = -8; i <= 8; i++) {
      P.path([M(i, -8), M(i, 8)], '#c9d6ec', 1); P.path([M(-8, i), M(8, i)], '#c9d6ec', 1);
    }
    P.path([[0, 0], M(1, 0), M(1, 1), M(0, 1)], det < 0 ? C.red : C.blue, 1.5, true, det < 0 ? 'rgba(192,57,43,.25)' : 'rgba(31,95,191,.25)');
    P.path([[0, 0], [1, 0], [1, 1], [0, 1]], C.gray, 1, true);
    const e1 = M(1, 0), e2 = M(0, 1);
    P.arrow(0, 0, e1[0], e1[1], C.green, 2.5); P.arrow(0, 0, e2[0], e2[1], C.orange, 2.5);
    P.text('Ae₁', e1[0], e1[1], C.green, 'left', 6, 4); P.text('Ae₂', e2[0], e2[1], C.orange, 'left', 6, -4);
    o.innerHTML = `A = [[${a.v}, ${b.v}], [${cc.v}, ${d.v}]] &nbsp; det A = ${a.v}·${d.v} − ${b.v}·${cc.v} = <b>${f2(det)}</b> &nbsp; ` +
      (Math.abs(det) < 1e-9 ? '<b>singular</b>: the plane collapses onto a line, no inverse' : det < 0 ? 'orientation flipped' : 'area scaled by ' + f2(det));
  };
};

V.eigen = box => {
  const c = canvas(box, 600, 400), P = plot(c, -4.75, 4.75, -3, 3);
  const r = row(box), a = slider(r, 'a', -2, 2, 0.1, 2), b = slider(r, 'b', -2, 2, 0.1, 1);
  const r1 = row(box), cc = slider(r1, 'c', -2, 2, 0.1, 1), d = slider(r1, 'd', -2, 2, 0.1, 2);
  const play = check(row(box), 'rotate x', true);
  const o = out(box);
  let th = 0.3;
  const draw = () => {
    const M = (x, y) => [a.v * x + b.v * y, cc.v * x + d.v * y];
    const tr = a.v + d.v, det = a.v * d.v - b.v * cc.v, disc = tr * tr / 4 - det;
    P.clear(); P.axes();
    P.path(range(121).map(i => { const t = i * Math.PI / 60; return [Math.cos(t), Math.sin(t)]; }), '#bbb', 1);
    P.path(range(121).map(i => M(Math.cos(i * Math.PI / 60), Math.sin(i * Math.PI / 60))), 'rgba(31,95,191,.35)', 1);
    let txt = '';
    if (disc >= 0) {
      [tr / 2 + Math.sqrt(disc), tr / 2 - Math.sqrt(disc)].forEach((l, i) => {
        let v = Math.abs(b.v) > 1e-9 ? [b.v, l - a.v] : Math.abs(cc.v) > 1e-9 ? [l - d.v, cc.v] : i ? [0, 1] : [1, 0];
        const n = Math.hypot(v[0], v[1]); v = [v[0] / n, v[1] / n];
        P.seg(-9 * v[0], -9 * v[1], 9 * v[0], 9 * v[1], C.green, 1.5, [6, 4]);
        txt += `λ${i ? '₂' : '₁'} = ${f2(l)} along (${f2(v[0])}, ${f2(v[1])}) &nbsp; `;
      });
    } else txt = `complex eigenvalues ${f2(tr / 2)} ± ${f2(Math.sqrt(-disc))}i: no real direction survives (A rotates everything)`;
    const x = [Math.cos(th), Math.sin(th)], Ax = M(x[0], x[1]);
    const par = Math.abs(x[0] * Ax[1] - x[1] * Ax[0]) / (Math.hypot(Ax[0], Ax[1]) || 1) < 0.04;
    P.arrow(0, 0, x[0], x[1], C.gray, 2); P.arrow(0, 0, Ax[0], Ax[1], par ? C.orange : C.blue, par ? 4 : 2.5);
    P.text('x', x[0], x[1], C.gray, 'left', 5, -5); P.text('Ax', Ax[0], Ax[1], par ? C.orange : C.blue, 'left', 5, -5);
    o.innerHTML = txt + (par ? '<br><b style="color:#d4800f">Ax is parallel to x: x is an eigenvector here.</b>' : '<br>trace = ' + f2(tr) + ', det = ' + f2(det));
  };
  loop(box, dt => { if (play.v) { th += dt * 0.5; draw(); } });
  return draw;
};

V.svd = box => {
  const N = 64, A = range(N).map(i => range(N).map(j => {
    let v = 0.15 + 0.15 * j / N;
    if ((i - 22) ** 2 + (j - 20) ** 2 < 170) v = 0.92;
    const rr = Math.hypot(i - 18, j - 46); if (rr > 9 && rr < 12.5) v = 0.8;
    if (i > 38 && i < 58 && j > 26 && j < 60) v = 0.55 + ((i + j) % 8 < 3 ? 0.3 : 0);
    if (Math.abs(i - 47 - 0.004 * (j - 43) ** 2) < 1.2 && j > 6 && j < 22) v = 0.95;
    return v;
  }));
  const comps = svdTop(A, 40, 7);
  const c = canvas(box, 600, 360), { ctx } = c;
  const k = slider(row(box), 'rank k', 1, 40, 1, 5);
  const o = out(box);
  const img = (M, x0) => { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const g = Math.round(255 * Math.max(0, Math.min(1, M[i][j]))); ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x0 + j * 4, 10 + i * 4, 4, 4); } };
  return () => {
    const B = range(N).map(() => new Array(N).fill(0));
    comps.slice(0, k.v).forEach(({ s, u, v }) => { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i][j] += s * u[i] * v[j]; });
    ctx.clearRect(0, 0, 600, 360); img(A, 30); img(B, 314);
    let e = 0, t = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { e += (A[i][j] - B[i][j]) ** 2; t += A[i][j] ** 2; }
    const s1 = comps[0].s;
    comps.forEach((p, i) => { const h = 68 * p.s / s1; ctx.fillStyle = i < k.v ? C.blue : '#ccc'; ctx.fillRect(30 + i * 13.6, 350 - h, 10, h); });
    ctx.fillStyle = C.gray; ctx.textAlign = 'right'; ctx.fillText('singular values σ₁ … σ₄₀ (blue = kept)', 570, 300);
    o.innerHTML = `Left: original (64 × 64 = 4096 numbers). Right: rank ${k.v}, stored as ${k.v}·(64 + 64 + 1) = ${k.v * 129} numbers (${(100 * k.v * 129 / 4096).toFixed(0)}%). Relative error ‖A − A<sub>k</sub>‖ / ‖A‖ = <b>${(100 * Math.sqrt(e / t)).toFixed(1)}%</b>`;
  };
};

/* ---------- Part I, chapter 3 ---------- */
// Banded contour background for f(x, y); darker bands are lower. Returns a fast redraw.
function field(P, f, lo, hi, n = 14) {
  const { w, h } = P.c, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), cell = 3;
  for (let px = 0; px < w; px += cell) for (let py = 0; py < h; py += cell) {
    const t = Math.max(0, Math.min(0.999, (f(P.ix(px + 1.5), P.iy(py + 1.5)) - lo) / (hi - lo)));
    g.fillStyle = `hsl(212, 45%, ${52 + 45 * Math.floor(t * n) / (n - 1)}%)`;
    g.fillRect(px, py, cell, cell);
  }
  return () => P.ctx.drawImage(cv, 0, 0, w, h);
}
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));

V.derivative = box => {
  const f = x => x ** 3 / 3 - x, df = x => x * x - 1;
  const c = canvas(box), P = plot(c, -3, 3, -3, 3);
  const r = row(box), x0 = slider(r, 'x₀', -2.5, 2.5, 0.05, 0.5), h = slider(r, 'h', 0.01, 2, 0.01, 1.2);
  const sd = check(row(box), 'show f′(x)', false);
  const o = out(box);
  return () => {
    const a = x0.v, y0 = f(a), s = (f(a + h.v) - y0) / h.v, t = df(a);
    P.clear(); P.axes();
    if (sd.v) P.fn(df, C.red, 1.5, [6, 4]);
    P.fn(f, C.blue);
    P.fn(x => y0 + s * (x - a), C.orange, 1.5);
    P.fn(x => y0 + t * (x - a), C.green, 2);
    P.dot(a, y0, 5, C.ink); P.dot(a + h.v, f(a + h.v), 5, C.orange);
    o.innerHTML = `f(x) = x³/3 − x. &nbsp; <span style="color:${C.orange}">secant slope = ${f2(s)}</span> &nbsp; <span style="color:${C.green}">tangent slope f′(x₀) = x₀² − 1 = ${f2(t)}</span> &nbsp; difference = ${f2(s - t)}`;
  };
};

V.chain = box => {
  const c = canvas(box, 600, 270), { ctx } = c;
  const r = row(box), xs = slider(r, 'x', -1.8, 1.8, 0.01, 0.8), dx = slider(r, 'Δx', 0.01, 0.5, 0.01, 0.2);
  const o = out(box);
  const lines = [['x', -2, 2, 50], ['u = g(x) = x²', 0, 4, 135], ['y = f(u) = sin u', -1.2, 1.2, 220]];
  const map = (v, lo, hi) => 50 + (v - lo) / (hi - lo) * 520;
  return () => {
    const x = xs.v, d = dx.v, u = x * x, u2 = (x + d) ** 2;
    const vals = [[x, x + d], [u, u2], [Math.sin(u), Math.sin(u2)]];
    ctx.clearRect(0, 0, 600, 270);
    const pts = [];
    lines.forEach(([name, lo, hi, Y], i) => {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(50, Y); ctx.lineTo(570, Y); ctx.stroke();
      ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'center';
      for (let t = Math.ceil(lo * 2) / 2; t <= hi + 1e-9; t += 0.5) { const X = map(t, lo, hi); ctx.beginPath(); ctx.moveTo(X, Y - 4); ctx.lineTo(X, Y + 4); ctx.stroke(); ctx.fillText(t, X, Y + 18); }
      ctx.font = FONT; ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(name, 50, Y - 20);
      const A = map(vals[i][0], lo, hi), B = map(vals[i][1], lo, hi);
      ctx.fillStyle = 'rgba(212,128,15,.4)'; ctx.fillRect(Math.min(A, B), Y - 7, Math.abs(B - A), 14);
      ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(A, Y, 5, 0, 7); ctx.fill();
      pts.push([A, Y]);
    });
    ctx.strokeStyle = C.gray; ctx.setLineDash([3, 3]); ctx.beginPath(); pts.forEach(([X, Y], i) => (i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y))); ctx.stroke(); ctx.setLineDash([]);
    const g1 = 2 * x, f1 = Math.cos(u);
    o.innerHTML = `du/dx = g′(x) = 2x = ${f2(g1)} &nbsp; dy/du = f′(u) = cos u = ${f2(f1)}<br>chain rule: dy/dx = ${f2(f1)} × ${f2(g1)} = <b>${f2(f1 * g1)}</b> &nbsp; measured Δy/Δx = ${f2((vals[2][1] - vals[2][0]) / d)} (the gap shrinks as Δx → 0)`;
  };
};

V.gradient = box => {
  const fns = {
    'bowl  x² + 3y²': [(x, y) => x * x + 3 * y * y, 0, 14, 0.15],
    'two valleys': [(x, y) => 2 - 2 * Math.exp(-((x - 1.2) ** 2 + (y + 0.3) ** 2)) - 1.4 * Math.exp(-((x + 1.6) ** 2 + (y - 0.9) ** 2) / 0.6), 0, 2.1, 0.8],
    'saddle  x² − y²': [(x, y) => x * x - y * y, -5, 9, 0.2],
  };
  const c = canvas(box, 600, 380), P = plot(c, -3.69, 3.69, -2.2, 2.2);
  const s = select(row(box), 'function', Object.keys(fns));
  const p = { x: 1.5, y: 1 };
  drag(P, [p]);
  const o = out(box);
  let key, bg;
  return () => {
    const [f, lo, hi, k] = fns[s.v];
    if (key !== s.v) { key = s.v; bg = field(P, f, lo, hi); }
    const e = 1e-4, gx = (f(p.x + e, p.y) - f(p.x - e, p.y)) / (2 * e), gy = (f(p.x, p.y + e) - f(p.x, p.y - e)) / (2 * e);
    P.clear(); bg();
    P.arrow(p.x, p.y, p.x + k * gx, p.y + k * gy, C.red, 2.5);
    P.arrow(p.x, p.y, p.x - k * gx, p.y - k * gy, C.blue, 2.5);
    P.dot(p.x, p.y, 6, C.ink);
    o.innerHTML = `point (${f2(p.x)}, ${f2(p.y)}), f = ${f2(f(p.x, p.y))} &nbsp; ∂f/∂x = ${f2(gx)}, ∂f/∂y = ${f2(gy)} &nbsp; ‖∇f‖ = ${f2(Math.hypot(gx, gy))} (arrows drawn at ${k}× length)`;
  };
};

V.taylor = box => {
  const fns = {
    'sin x': [Math.sin, (a, n) => Math.sin(a + n * Math.PI / 2)],
    'eˣ': [Math.exp, a => Math.exp(a)],
    'ln(1 + x)': [x => (x > -1 ? Math.log(1 + x) : NaN), (a, n) => (n === 0 ? Math.log(1 + a) : ((n % 2 ? 1 : -1) * fact(n - 1)) / (1 + a) ** n)],
  };
  const c = canvas(box), P = plot(c, -6, 6, -3, 4);
  const s = select(row(box), 'function', Object.keys(fns));
  const r = row(box), a = slider(r, 'center a', -2, 2, 0.05, 0), n = slider(r, 'order n', 0, 12, 1, 3);
  const o = out(box);
  return () => {
    const [f, d] = fns[s.v], A = s.v === 'ln(1 + x)' ? Math.max(a.v, -0.7) : a.v;
    const co = range(n.v + 1).map(k => d(A, k) / fact(k)), p = x => sum(co.map((q, k) => q * (x - A) ** k));
    P.clear(); P.axes();
    P.fn(f, C.blue, 2.5); P.fn(p, C.red, 2);
    P.dot(A, f(A), 5, C.ink);
    o.innerHTML = `order-${n.v} Taylor polynomial at a = ${f2(A)}. &nbsp; error at x = a + 1: |f − p| = ${f2(Math.abs(f(A + 1) - p(A + 1)))}; at x = a + 3: ${f2(Math.abs(f(A + 3) - p(A + 3)))}` +
      (s.v === 'ln(1 + x)' ? ' &nbsp; (the ln series only converges for |x − a| &lt; 1 + a)' : '');
  };
};

V.integral = box => {
  const fns = { 'x²': [x => x * x, -1, 9.5], 'sin x': [Math.sin, -1.3, 1.3], 'e^(−x²)': [x => Math.exp(-x * x), -0.2, 1.2] };
  const c = canvas(box), P = plot(c, -3.2, 3.2, -1, 9.5);
  const r = row(box), s = select(r, 'function', Object.keys(fns)), rule = select(r, 'rule', ['left', 'midpoint', 'right'], 'left');
  const r2 = row(box), a = slider(r2, 'a', -3, 3, 0.1, 0), b = slider(r2, 'b', -3, 3, 0.1, 2), n = slider(r2, 'n', 1, 60, 1, 6);
  const o = out(box);
  return () => {
    const [f, lo, hi] = fns[s.v]; P.y0 = lo; P.y1 = hi;
    const A = Math.min(a.v, b.v), B = Math.max(a.v, b.v), dx = (B - A) / n.v, off = { left: 0, midpoint: 0.5, right: 1 }[rule.v];
    P.clear(); P.axes();
    let S = 0;
    for (let i = 0; i < n.v; i++) {
      const x = A + i * dx, y = f(x + off * dx); S += y * dx;
      P.rect(x, Math.min(0, y), x + dx, Math.max(0, y), y >= 0 ? 'rgba(31,95,191,.25)' : 'rgba(192,57,43,.25)', y >= 0 ? C.blue : C.red);
    }
    P.fn(f, C.ink, 2);
    let E = 0; const m = 20000, h = (B - A) / m; for (let i = 0; i < m; i++) E += f(A + (i + 0.5) * h) * h;
    o.innerHTML = `Riemann sum with n = ${n.v} (${rule.v}) = <b>${f2(S)}</b> &nbsp; true integral = ${f2(E)} &nbsp; error = ${f2(S - E)}`;
  };
};

/* ---------- Part I, chapter 4 ---------- */
function lgamma(z) { // Lanczos approximation of log Γ(z)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
const betaPdf = (x, a, b) => (x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lgamma(a) - lgamma(b) + lgamma(a + b)));
const normPdf = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
const pct = v => (v * 100).toFixed(1) + '%';
const xlogy = (k, p) => (k === 0 ? 0 : k * Math.log(p));

V.lln = box => {
  const c = canvas(box), P = plot(c, 0, 50, 0, 1);
  const r = row(box), p = slider(r, 'true p', 0.05, 0.95, 0.05, 0.5), auto = check(r, 'auto-flip', false);
  let flips = [], heads = 0;
  const rnd = rng(3), add = k => { for (let i = 0; i < k; i++) { const h = rnd() < p.v ? 1 : 0; heads += h; flips.push(heads / (flips.length + 1)); } };
  const r2 = row(box);
  button(r2, 'Flip 1', () => add(1)); button(r2, 'Flip 10', () => add(10)); button(r2, 'Flip 100', () => add(100)); button(r2, 'Reset', () => { flips = []; heads = 0; });
  const o = out(box);
  const draw = () => {
    const n = flips.length; P.x1 = Math.max(50, n * 1.1);
    P.clear(); P.axes();
    const band = s => range(200).map(i => { const m = 1 + (P.x1 - 1) * i / 199; return [m, Math.max(0, Math.min(1, p.v + s * 2 * Math.sqrt(p.v * (1 - p.v) / m)))]; });
    P.path(band(1).concat(band(-1).reverse()), null, 1, true, 'rgba(0,0,0,.08)');
    P.seg(0, p.v, P.x1, p.v, C.red, 1, [5, 4]);
    if (n) P.path(flips.map((f, i) => [i + 1, f]), C.blue, 1.5);
    o.innerHTML = n ? `n = ${n} flips, ${heads} heads, fraction = <b>${f2(heads / n)}</b>, gap from p = ${f2(heads / n - p.v)}, 2σ band = ±${f2(2 * Math.sqrt(p.v * (1 - p.v) / n))}` : 'Press a button to flip.';
  };
  loop(box, () => { if (auto.v && flips.length < 5000) { add(4); draw(); } });
  return draw;
};

V.bayes = box => {
  const c = canvas(box, 600, 285), { ctx } = c;
  const r = row(box), prev = slider(r, 'prevalence', 0.001, 0.3, 0.001, 0.01, pct), sens = slider(r, 'sensitivity', 0.5, 1, 0.01, 0.9, pct);
  const fpr = slider(row(box), 'false positive rate', 0, 0.3, 0.005, 0.09, pct);
  const o = out(box);
  return () => {
    const N = 1000, S = Math.round(N * prev.v), TP = Math.round(S * sens.v), FN = S - TP, H = N - S, FP = Math.round(H * fpr.v), TN = H - FP;
    ctx.clearRect(0, 0, 600, 285);
    let i = 0;
    [[TP, C.red], [FN, '#f3c4be'], [FP, C.orange], [TN, '#e4e4e4']].forEach(([k, col]) => {
      for (let j = 0; j < k; j++, i++) { ctx.fillStyle = col; ctx.fillRect(20 + (i % 50) * 11.2, 10 + Math.floor(i / 50) * 11.2, 9.6, 9.6); }
    });
    ctx.textAlign = 'left'; ctx.font = FONT;
    [['sick, test +', C.red, TP], ['sick, test −', '#e8a49b', FN], ['healthy, test +', C.orange, FP], ['healthy, test −', '#aaa', TN]].forEach(([t, col, k], j) => {
      ctx.fillStyle = col; ctx.fillRect(20 + j * 145, 252, 12, 12); ctx.fillStyle = C.ink; ctx.fillText(`${t} (${k})`, 36 + j * 145, 263);
    });
    const post = sens.v * prev.v / (sens.v * prev.v + fpr.v * (1 - prev.v));
    o.innerHTML = `P(sick | +) = ${f2(sens.v)}·${f2(prev.v)} / (${f2(sens.v)}·${f2(prev.v)} + ${f2(fpr.v)}·${f2(1 - prev.v)}) = <b>${pct(post)}</b> &nbsp; (${TP} of the ${TP + FP} positives are sick)`;
  };
};

V.dists = box => {
  const D = {
    Bernoulli: { ps: [['p', 0, 1, 0.01, 0.3]], disc: 1, f: (x, [p]) => (x === 0 ? 1 - p : x === 1 ? p : 0), xr: () => [-0.5, 1.5], mv: ([p]) => [p, p * (1 - p)] },
    Binomial: { ps: [['n', 1, 40, 1, 10], ['p', 0.01, 0.99, 0.01, 0.4]], disc: 1, f: (x, [n, p]) => (x > n ? 0 : Math.exp(lgamma(n + 1) - lgamma(x + 1) - lgamma(n - x + 1) + x * Math.log(p) + (n - x) * Math.log(1 - p))), xr: ([n]) => [-0.5, n + 0.5], mv: ([n, p]) => [n * p, n * p * (1 - p)] },
    Poisson: { ps: [['λ', 0.2, 20, 0.1, 4]], disc: 1, f: (x, [l]) => Math.exp(x * Math.log(l) - l - lgamma(x + 1)), xr: ([l]) => [-0.5, Math.ceil(l + 4 * Math.sqrt(l) + 3) + 0.5], mv: ([l]) => [l, l] },
    Uniform: { ps: [['a', -3, 3, 0.1, 0], ['b', -3, 6, 0.1, 2]], f: (x, [a, b]) => (x >= Math.min(a, b) && x <= Math.max(a, b) ? 1 / Math.max(Math.abs(b - a), 0.1) : 0), xr: () => [-4, 7], mv: ([a, b]) => [(a + b) / 2, (b - a) ** 2 / 12] },
    Normal: { ps: [['μ', -3, 3, 0.1, 0], ['σ', 0.2, 3, 0.05, 1]], f: (x, [m, s]) => normPdf(x, m, s), xr: () => [-6, 6], mv: ([m, s]) => [m, s * s] },
    Exponential: { ps: [['λ', 0.2, 4, 0.05, 1]], f: (x, [l]) => (x < 0 ? 0 : l * Math.exp(-l * x)), xr: () => [-0.5, 6], mv: ([l]) => [1 / l, 1 / (l * l)] },
    Beta: { ps: [['α', 0.5, 10, 0.1, 2], ['β', 0.5, 10, 0.1, 5]], f: (x, [a, b]) => betaPdf(x, a, b), xr: () => [-0.05, 1.05], mv: ([a, b]) => [a / (a + b), a * b / ((a + b) ** 2 * (a + b + 1))] },
  };
  const c = canvas(box), P = plot(c, 0, 1, 0, 1);
  const s = select(row(box), 'distribution', Object.keys(D), 'Normal');
  const pr = row(box), o = out(box);
  let cur, sl = [];
  return () => {
    const d = D[s.v];
    if (cur !== s.v) { cur = s.v; pr.innerHTML = ''; sl = d.ps.map(([n, a, b, st, v]) => slider(pr, n, a, b, st, v)); }
    const th = sl.map(q => q.v), [x0, x1] = d.xr(th);
    const xs = d.disc ? range(Math.floor(x1) + 1) : range(601).map(i => x0 + (x1 - x0) * i / 600);
    const ys = xs.map(x => d.f(x, th)), top = Math.min(6, Math.max(...ys.filter(isFinite))) * 1.15 || 1;
    Object.assign(P, { x0, x1, y0: -0.05 * top, y1: top });
    P.clear(); P.axes();
    let F = 0;
    const cdf = [];
    if (d.disc) xs.forEach((x, i) => { P.rect(x - 0.35, 0, x + 0.35, ys[i], 'rgba(31,95,191,.35)', C.blue); cdf.push([x - 0.5, F]); F += ys[i]; cdf.push([x - 0.5, F], [x + 0.5, F]); });
    else { xs.forEach((x, i) => { if (i) F += (Math.min(ys[i], 1e3) + Math.min(ys[i - 1], 1e3)) / 2 * (x - xs[i - 1]); cdf.push([x, F]); }); P.path(xs.map((x, i) => [x, Math.min(ys[i], top * 2)]), C.blue, 2.5); }
    const sc = top / 1.15;
    P.path(cdf.map(([x, q]) => [x, Math.min(1, q) * sc]), C.gray, 1.5, false); 
    P.text('CDF = 1', x1, sc, C.gray, 'right', -4, -4);
    const [m, v] = d.mv(th);
    P.seg(m, 0, m, top, C.orange, 2, [5, 4]);
    o.innerHTML = `mean = <b>${f2(m)}</b>, variance = <b>${f2(v)}</b>, standard deviation = ${f2(Math.sqrt(v))}`;
  };
};

V.variance = box => {
  const c = canvas(box, 600, 300), P = plot(c, -0.5, 10.5, -0.6, 4.33);
  const pts = [2, 3.5, 4.2, 6, 8.5].map(x => ({ x, y: 0 }));
  drag(P, pts, p => { p.y = 0; p.x = Math.max(0, Math.min(10, p.x)); });
  const o = out(box);
  return () => {
    const n = pts.length, m = sum(pts.map(p => p.x)) / n, ss = sum(pts.map(p => (p.x - m) ** 2));
    P.clear(); P.axes(false);
    pts.forEach((p, i) => { const d = Math.abs(p.x - m); P.rect(Math.min(p.x, m), 0, Math.max(p.x, m), d, PAL[i % 5] + '33', PAL[i % 5]); });
    P.seg(m, -0.6, m, 4.33, C.ink, 1.5, [5, 4]); P.text('x̄', m, 4.1, C.ink, 'left', 4);
    pts.forEach((p, i) => P.dot(p.x, 0, 7, PAL[i % 5]));
    o.innerHTML = `x̄ = ${f2(m)} &nbsp; Σ(xᵢ − x̄)² = ${f2(ss)} &nbsp; variance (÷n) = <b>${f2(ss / n)}</b> &nbsp; sample variance (÷(n−1)) = ${f2(ss / (n - 1))} &nbsp; σ = ${f2(Math.sqrt(ss / n))}`;
  };
};

V.gauss2d = box => {
  const c = canvas(box, 600, 400), P = plot(c, -6.33, 6.33, -4, 4);
  const r = row(box), sx = slider(r, 'σ₁', 0.3, 2.5, 0.05, 1.8), sy = slider(r, 'σ₂', 0.3, 2.5, 0.05, 0.9), rho = slider(r, 'ρ', -0.95, 0.95, 0.05, 0.6);
  const rnd = rng(11), Z = range(400).map(() => [gauss(rnd), gauss(rnd)]);
  const o = out(box);
  return () => {
    const a = sx.v, b = sy.v, p = rho.v, L = [[a, 0], [p * b, b * Math.sqrt(1 - p * p)]];
    const T = ([u, v]) => [L[0][0] * u, L[1][0] * u + L[1][1] * v];
    P.clear(); P.axes();
    const X = Z.map(T);
    X.forEach(([x, y]) => P.dot(x, y, 2, 'rgba(31,95,191,.5)'));
    [1, 2].forEach(k => P.path(range(101).map(i => T([k * Math.cos(i * Math.PI / 50), k * Math.sin(i * Math.PI / 50)])), C.red, 1.5, true));
    const s11 = a * a, s12 = p * a * b, s22 = b * b, mid = (s11 + s22) / 2, rad = Math.sqrt(((s11 - s22) / 2) ** 2 + s12 * s12);
    [mid + rad, mid - rad].forEach((l, i) => {
      let v = Math.abs(s12) > 1e-9 ? [s12, l - s11] : i ? [0, 1] : [1, 0]; const n = Math.hypot(...v), q = Math.sqrt(Math.max(l, 0));
      v = [v[0] / n * q, v[1] / n * q]; P.arrow(0, 0, v[0], v[1], C.green, 2.5); P.arrow(0, 0, -v[0], -v[1], C.green, 2.5);
    });
    const mx = sum(X.map(q => q[0])) / 400, my = sum(X.map(q => q[1])) / 400;
    const cxy = sum(X.map(q => (q[0] - mx) * (q[1] - my))), cxx = sum(X.map(q => (q[0] - mx) ** 2)), cyy = sum(X.map(q => (q[1] - my) ** 2));
    o.innerHTML = `Σ = [[${f2(s11)}, ${f2(s12)}], [${f2(s12)}, ${f2(s22)}]] &nbsp; eigenvalues ${f2(mid + rad)}, ${f2(mid - rad)} &nbsp; sample correlation of the 400 points = ${f2(cxy / Math.sqrt(cxx * cyy))}`;
  };
};

V.clt = box => {
  const B = {
    'uniform(0, 1)': [r => r(), 0.5, 1 / 12],
    'exponential(1)': [r => -Math.log(r() + 1e-12), 1, 1],
    'coin, p = 0.2': [r => (r() < 0.2 ? 1 : 0), 0.2, 0.16],
    'two bumps': [r => (r() < 0.5 ? 0.2 : 0.8) + 0.1 * gauss(r), 0.5, 0.1],
  };
  const c = canvas(box), { ctx } = c, P = plot(c, 0, 1, 0, 1);
  const r = row(box), s = select(r, 'start from', Object.keys(B), 'exponential(1)'), n = slider(r, 'n', 1, 50, 1, 1);
  let seed = 5; button(r, 'Resample', () => seed++);
  const o = out(box);
  return () => {
    const [draw1, mu, v] = B[s.v], rnd = rng(seed), se = Math.sqrt(v / n.v);
    const means = range(4000).map(() => { let t = 0; for (let i = 0; i < n.v; i++) t += draw1(rnd); return t / n.v; });
    Object.assign(P, { x0: mu - 4.5 * se, x1: mu + 4.5 * se });
    const bins = 40, w = (P.x1 - P.x0) / bins, h = new Array(bins).fill(0);
    means.forEach(m => { const k = Math.floor((m - P.x0) / w); if (k >= 0 && k < bins) h[k]++; });
    const dens = h.map(k => k / (4000 * w)); P.y0 = 0; P.y1 = Math.max(...dens, normPdf(mu, mu, se)) * 1.1;
    P.clear(); P.axes();
    dens.forEach((d, i) => P.rect(P.x0 + i * w, 0, P.x0 + (i + 1) * w, d, 'rgba(31,95,191,.3)', C.blue));
    P.fn(x => normPdf(x, mu, se), C.red, 2);
    // inset: one raw draw per sample
    const raw = range(4000).map(() => draw1(rnd)), lo = Math.min(...raw), hi = Math.max(...raw), rb = new Array(30).fill(0);
    raw.forEach(x => rb[Math.min(29, Math.floor((x - lo) / (hi - lo + 1e-9) * 30))]++);
    const mx = Math.max(...rb);
    ctx.fillStyle = '#fff'; ctx.fillRect(440, 8, 150, 70); ctx.strokeStyle = '#ccc'; ctx.strokeRect(440, 8, 150, 70);
    rb.forEach((k, i) => { ctx.fillStyle = C.gray; ctx.fillRect(445 + i * 4.7, 72 - 58 * k / mx, 4, 58 * k / mx); });
    o.innerHTML = `${n.v} draws per average. Mean of averages = ${f2(sum(means) / 4000)} (μ = ${f2(mu)}), standard error σ/√n = ${f2(se)}`;
  };
};

V.mle = box => {
  const c1 = canvas(box, 600, 190), c2 = canvas(box, 600, 190), P1 = plot(c1, 0, 1, 0, 1.1), P2 = plot(c2, 0, 1, -12, 1);
  const r = row(box), k = slider(r, 'heads k', 0, 50, 1, 7), t = slider(r, 'tails', 0, 50, 1, 3), q = slider(row(box), 'probe p', 0.01, 0.99, 0.01, 0.4);
  const o = out(box);
  return () => {
    const n = k.v + t.v, ph = n ? k.v / n : 0.5, ll = p => xlogy(k.v, p) + xlogy(t.v, 1 - p), mx = ll(Math.min(0.9999, Math.max(1e-4, ph)));
    P1.clear(); P1.axes(); P2.clear(); P2.axes();
    P1.fn(p => (p <= 0 || p >= 1 ? NaN : Math.exp(ll(p) - mx)), C.blue, 2.5);
    P2.fn(p => (p <= 0 || p >= 1 ? NaN : ll(p) - mx), C.red, 2.5);
    [P1, P2].forEach(P => { P.seg(ph, P.y0, ph, P.y1, C.green, 1.5, [5, 4]); P.seg(q.v, P.y0, q.v, P.y1, C.gray, 1); });
    P1.text('L(p) / L(p̂)', 0.02, 1.02, C.blue); P2.text('log L(p) − log L(p̂)', 0.02, 0.2, C.red);
    o.innerHTML = `n = ${n}, p̂ = k/n = <b>${f2(ph)}</b> &nbsp; at p = ${q.v}: log L = ${f2(ll(q.v))}, versus log L(p̂) = ${f2(mx)}`;
  };
};

V.mapest = box => {
  const c = canvas(box), P = plot(c, 0, 1, 0, 6);
  const r = row(box), a = slider(r, 'prior α', 0.5, 20, 0.5, 4), b = slider(r, 'prior β', 0.5, 20, 0.5, 4);
  const r2 = row(box), k = slider(r2, 'heads', 0, 50, 1, 3), t = slider(r2, 'tails', 0, 50, 1, 0);
  const o = out(box);
  return () => {
    const n = k.v + t.v, A = a.v + k.v, Bb = b.v + t.v;
    const curves = [[x => betaPdf(x, a.v, b.v), C.gray], [x => betaPdf(x, k.v + 1, t.v + 1), C.orange], [x => betaPdf(x, A, Bb), C.blue]];
    let top = 0; for (let i = 1; i < 200; i++) curves.forEach(([f]) => (top = Math.max(top, f(i / 200))));
    P.y1 = Math.min(top * 1.1, 14);
    P.clear(); P.axes();
    curves.forEach(([f, col]) => P.fn(f, col, 2.5));
    const mle = n ? k.v / n : NaN, map = (A - 1) / (A + Bb - 2);
    if (n) P.seg(mle, 0, mle, P.y1, C.orange, 1.5, [5, 4]);
    P.seg(map, 0, map, P.y1, C.blue, 1.5, [5, 4]);
    o.innerHTML = `<span style="color:${C.orange}">MLE = k/n = ${n ? f2(mle) : 'undefined'}</span> &nbsp; <span style="color:${C.blue}">MAP = (k + α − 1)/(n + α + β − 2) = <b>${f2(map)}</b></span> &nbsp; posterior mean = ${f2(A / (A + Bb))}`;
  };
};

/* ---------- Part I, chapters 5 and 6 ---------- */
function solve(A, b) { // Gaussian elimination with partial pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
// Least-squares polynomial on [-1, 1] in the Chebyshev basis (better conditioned than powers of x).
function polyfit(xs, ys, d, lam = 1e-8) {
  const F = x => range(d + 1).map(k => Math.cos(k * Math.acos(Math.max(-1, Math.min(1, x)))));
  const X = xs.map(F), A = range(d + 1).map(i => range(d + 1).map(j => sum(X.map(r => r[i] * r[j])) + (i === j ? lam : 0)));
  const w = solve(A, range(d + 1).map(i => sum(X.map((r, n) => r[i] * ys[n]))));
  return x => sum(F(x).map((v, k) => v * w[k]));
}
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2));

V.biasvar = box => {
  const f = x => Math.sin(3 * x), rnd = rng(21), noise = 0.3;
  const sets = range(20).map(() => { const xs = range(15).map(() => rnd() * 2 - 1).sort((a, b) => a - b); return [xs, xs.map(x => f(x) + noise * gauss(rnd))]; });
  const test = range(300).map(() => { const x = rnd() * 2 - 1; return [x, f(x) + noise * gauss(rnd)]; });
  const err = range(13).map(d => {
    const fits = sets.map(([xs, ys]) => polyfit(xs, ys, d));
    const tr = sum(fits.map((g, s) => sum(sets[s][0].map((x, i) => (g(x) - sets[s][1][i]) ** 2)) / 15)) / 20;
    const te = sum(fits.map(g => sum(test.map(([x, y]) => (g(x) - y) ** 2)) / 300)) / 20;
    return [tr, te];
  });
  const c = canvas(box, 600, 300), P = plot(c, -1, 1, -2.2, 2.2), c2 = canvas(box, 600, 170), Q = plot(c2, -0.5, 12.5, 0, 0.8);
  const d = slider(row(box), 'polynomial degree', 0, 12, 1, 3);
  const o = out(box);
  return () => {
    const fits = sets.map(([xs, ys]) => polyfit(xs, ys, d.v)), avg = x => sum(fits.map(g => g(x))) / 20;
    P.clear(); P.axes();
    fits.forEach(g => P.fn(g, 'rgba(31,95,191,.25)', 1));
    sets[0][0].forEach((x, i) => P.dot(x, sets[0][1][i], 3, C.gray));
    P.fn(f, C.ink, 1.5, [6, 4]); P.fn(avg, C.blue, 3);
    let b2 = 0, va = 0; range(100).forEach(i => { const x = -0.98 + 1.96 * i / 99, m = avg(x); b2 += (m - f(x)) ** 2 / 100; va += sum(fits.map(g => (g(x) - m) ** 2)) / 20 / 100; });
    Q.clear(); Q.axes();
    Q.path(err.map(([a], k) => [k, Math.min(a, 0.8)]), C.blue, 2); Q.path(err.map(([, b], k) => [k, Math.min(b, 0.8)]), C.red, 2);
    Q.seg(d.v, 0, d.v, 0.8, C.gray, 1, [4, 4]); Q.text('error vs degree', 12.4, 0.72, C.gray, 'right');
    o.innerHTML = `degree ${d.v}: bias² = ${f2(b2)}, variance = ${f2(va)}, noise σ² = ${f2(noise * noise)} &nbsp; <span style="color:${C.blue}">train MSE = ${f2(err[d.v][0])}</span> &nbsp; <span style="color:${C.red}">test MSE = ${f2(err[d.v][1])}</span>`;
  };
};

V.pvalue = box => {
  const c = canvas(box), P = plot(c, -4, 4, 0, 1);
  const r = row(box), dd = slider(r, 'observed difference', 0, 4, 0.05, 1.2), s = slider(r, 'std s', 2, 30, 1, 10);
  const n = slider(row(box), 'n per group', 10, 3000, 10, 200);
  const o = out(box);
  return () => {
    const se = s.v * Math.sqrt(2 / n.v), d = dd.v, z = d / se, p = 2 * (1 - Phi(z)), W = Math.max(4 * se, 1.3 * d + 2 * se);
    Object.assign(P, { x0: -W, x1: W, y0: -0.12 / se, y1: 1.1 * normPdf(0, 0, se) });
    P.clear(); P.axes(false);
    [[d, W], [-W, -d]].forEach(([a, b]) => P.path([[a, 0], ...range(81).map(i => { const x = a + (b - a) * i / 80; return [x, normPdf(x, 0, se)]; }), [b, 0]], null, 1, true, 'rgba(192,57,43,.35)'));
    P.fn(x => normPdf(x, 0, se), C.blue, 2.5);
    P.seg(d, 0, d, P.y1, C.red, 2); P.text('observed', d, P.y1 * 0.92, C.red, 'left', 4);
    const yb = P.y0 * 0.5; P.seg(d - 1.96 * se, yb, d + 1.96 * se, yb, C.green, 3); P.dot(d, yb, 4, C.green);
    P.text('95% CI', d + 1.96 * se, yb, C.green, 'left', 6, 4);
    o.innerHTML = `SE = s·√(2/n) = ${f2(se)} &nbsp; z = ${f2(z)} &nbsp; p = <b>${p < 1e-4 ? p.toExponential(1) : f2(p)}</b> ${p < 0.05 ? '(significant at α = 0.05)' : '(not significant at α = 0.05)'} &nbsp; <span style="color:${C.green}">95% CI = [${f2(d - 1.96 * se)}, ${f2(d + 1.96 * se)}]</span>`;
  };
};

V.gd1d = box => {
  const F = { 'bowl  x²': [x => x * x, x => 2 * x, -1, 16], 'bumpy  x²/4 + sin 3x': [x => x * x / 4 + Math.sin(3 * x), x => x / 2 + 3 * Math.cos(3 * x), -1.5, 5] };
  const c = canvas(box), P = plot(c, -4, 4, -1, 16);
  const s = select(row(box), 'function', Object.keys(F));
  const r = row(box), eta = slider(r, 'η', 0.01, 1.2, 0.01, 0.1), x0 = slider(r, 'start', -3.8, 3.8, 0.05, 3.2);
  let xs = [], sig = '', run = false;
  const step = () => { const x = xs[xs.length - 1]; if (Math.abs(x) < 1e6 && xs.length < 200) xs.push(x - eta.v * F[s.v][1](x)); };
  const r2 = row(box); button(r2, 'Step', step); button(r2, 'Run / pause', () => (run = !run)); button(r2, 'Reset', () => (sig = ''));
  const o = out(box);
  let acc = 0;
  const draw = () => {
    const [f, df, lo, hi] = F[s.v], k = s.v + eta.v + x0.v;
    if (k !== sig) { sig = k; xs = [x0.v]; run = false; }
    P.y0 = lo; P.y1 = hi; P.clear(); P.axes(); P.fn(f, C.ink, 2);
    xs.forEach((x, i) => { if (i) P.arrow(xs[i - 1], f(xs[i - 1]), x, f(x), C.orange, 1.5); });
    xs.forEach(x => P.dot(x, f(x), 3, C.orange));
    const x = xs[xs.length - 1]; P.dot(x, f(x), 6, C.red);
    o.innerHTML = `step t = ${xs.length - 1}, x = ${f2(x)}, f(x) = ${f2(f(x))}, f′(x) = ${f2(df(x))}` + (Math.abs(x) > 1e3 ? ' &nbsp; <b>diverged</b>' : '');
  };
  loop(box, dt => { if (run && (acc += dt) > 0.2) { acc = 0; step(); draw(); } });
  return draw;
};

V.convex = box => {
  const F = { 'x²': x => x * x / 2, 'eˣ': x => Math.exp(x) / 4, '|x|': x => Math.abs(x), 'x⁴ − 3x² (nonconvex)': x => (x ** 4 - 3 * x * x) / 2 + 2, 'sin x (nonconvex)': x => Math.sin(1.5 * x) + 2 };
  const c = canvas(box), P = plot(c, -3, 3, -0.5, 5);
  const s = select(row(box), 'function', Object.keys(F), 'x⁴ − 3x² (nonconvex)');
  const A = { x: -2, y: 0 }, B = { x: 1.6, y: 0 };
  drag(P, [A, B], p => { p.x = Math.max(-3, Math.min(3, p.x)); });
  const o = out(box);
  return () => {
    const f = F[s.v]; A.y = f(A.x); B.y = f(B.x);
    P.clear(); P.axes();
    let bad = false;
    const lo = Math.min(A.x, B.x), hi = Math.max(A.x, B.x), ch = x => A.y + (B.y - A.y) * (x - A.x) / (B.x - A.x || 1e-9);
    for (let i = 0; i < 120; i++) {
      const x = lo + (hi - lo) * i / 120, x2 = x + (hi - lo) / 120;
      if (f(x) > ch(x) + 1e-9) { bad = true; P.path([[x, ch(x)], [x, f(x)], [x2, f(x2)], [x2, ch(x2)]], null, 1, true, 'rgba(192,57,43,.45)'); }
    }
    P.fn(f, C.blue, 2.5);
    P.seg(A.x, A.y, B.x, B.y, C.ink, 2);
    P.dot(A.x, A.y, 6, C.ink); P.dot(B.x, B.y, 6, C.ink);
    o.innerHTML = bad ? '<b style="color:#c0392b">The chord dips below the graph: this function is not convex.</b>' : 'The chord stays above the graph on this segment. Try other segments; a convex function passes every one.';
  };
};

V.newton = box => {
  const f = x => x * x / 2 + Math.exp(-x), d1 = x => x - Math.exp(-x), d2 = x => 1 + Math.exp(-x), xs = 0.5671432904097838;
  const c = canvas(box), P = plot(c, -3, 4, -0.5, 8);
  const x0 = slider(row(box), 'start', -2.5, 3.8, 0.05, -2);
  let N = [], G = [], sig;
  const r = row(box);
  button(r, 'Step', () => { const a = N[N.length - 1], b = G[G.length - 1]; N.push(a - d1(a) / d2(a)); G.push(b - 0.3 * d1(b)); });
  button(r, 'Reset', () => (sig = null));
  const o = out(box);
  return () => {
    if (sig !== x0.v) { sig = x0.v; N = [x0.v]; G = [x0.v]; }
    const a = N[N.length - 1];
    P.clear(); P.axes(); P.fn(f, C.ink, 2.5);
    P.fn(x => f(a) + d1(a) * (x - a) + d2(a) * (x - a) ** 2 / 2, C.orange, 1.5, [6, 4]);
    G.forEach((x, i) => { P.dot(x, f(x), 4, C.blue); if (i) P.seg(G[i - 1], f(G[i - 1]), x, f(x), C.blue, 1); });
    N.forEach((x, i) => { P.dot(x, f(x), 5, C.red); if (i) P.seg(N[i - 1], f(N[i - 1]), x, f(x), C.red, 1.5); });
    P.seg(xs, -0.5, xs, 8, C.green, 1, [3, 3]);
    const e = a => a.map(x => Math.abs(x - xs).toExponential(1)).join(', ');
    o.innerHTML = `<span style="color:${C.red}">Newton error: ${e(N)}</span><br><span style="color:${C.blue}">GD (η = 0.3) error: ${e(G)}</span>`;
  };
};

V.lagrange = box => {
  const f = (x, y) => (x - 2) ** 2 + (y - 1) ** 2;
  const c = canvas(box, 600, 400), P = plot(c, -3.16, 3.16, -2, 2), bg = field(P, f, 0, 20, 16);
  const p = { x: -0.6, y: 0.8 };
  drag(P, [p], q => { const n = Math.hypot(q.x, q.y) || 1; q.x /= n; q.y /= n; });
  const o = out(box);
  return () => {
    P.clear(); bg();
    P.path(range(101).map(i => [Math.cos(i * Math.PI / 50), Math.sin(i * Math.PI / 50)]), C.ink, 2.5, true);
    const gf = [2 * (p.x - 2), 2 * (p.y - 1)], gg = [2 * p.x, 2 * p.y], s = 2 / Math.sqrt(5);
    P.dot(2 * s / 2, s / 2, 5, C.green, true);
    P.arrow(p.x, p.y, p.x + 0.25 * gf[0], p.y + 0.25 * gf[1], C.red, 2.5);
    P.arrow(p.x, p.y, p.x + 0.4 * gg[0], p.y + 0.4 * gg[1], C.green, 2.5);
    P.dot(p.x, p.y, 6, C.ink); P.dot(2, 1, 4, C.ink); P.text('(2, 1)', 2, 1, C.ink, 'left', 6, -4);
    const sn = Math.abs(gf[0] * gg[1] - gf[1] * gg[0]) / (Math.hypot(...gf) * Math.hypot(...gg)), lam = (gf[0] * gg[0] + gf[1] * gg[1]) / (gg[0] ** 2 + gg[1] ** 2);
    o.innerHTML = `f = ${f2(f(p.x, p.y))} &nbsp; sin(angle between ∇f and ∇g) = ${f2(sn)} &nbsp; ` + (sn < 0.02 ? `<b>aligned: ∇f = λ∇g with λ = ${f2(lam)}</b>` + (f(p.x, p.y) < 3 ? ' (minimum)' : ' (maximum)') : 'not aligned: sliding along the circle still changes f');
  };
};

/* ---------- Part I, chapters 7 and 8 ---------- */
// Arrow in pixel coordinates.
function parrow(ctx, x1, y1, x2, y2, col, lw = 1.5) {
  const t = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 9 * Math.cos(t - 0.4), y2 - 9 * Math.sin(t - 0.4)); ctx.lineTo(x2 - 9 * Math.cos(t + 0.4), y2 - 9 * Math.sin(t + 0.4)); ctx.fill();
}

V.entropy = box => {
  const c = canvas(box, 600, 300), P = plot(c, 0, 4, -0.32, 1.12);
  const r = row(box), w = ['A', 'B', 'C', 'D'].map((n, i) => slider(r, n, 0, 10, 0.1, [6, 2, 1, 1][i]));
  const r2 = row(box);
  button(r2, 'Certain', () => [10, 0, 0, 0].forEach((v, i) => (w[i].v = v)));
  button(r2, 'Uniform', () => w.forEach(q => (q.v = 5)));
  button(r2, 'Two equal', () => [5, 5, 0, 0].forEach((v, i) => (w[i].v = v)));
  const o = out(box);
  return () => {
    const t = sum(w.map(q => q.v)) || 1, p = w.map(q => q.v / t), H = -sum(p.map(x => (x > 0 ? x * Math.log2(x) : 0)));
    P.clear();
    p.forEach((x, i) => {
      P.rect(i + 0.15, 0, i + 0.85, x, PAL[i] + '55', PAL[i]);
      P.text(`p = ${f2(x)}`, i + 0.5, x, C.ink, 'center', 0, -18);
      P.text(x > 0 ? `${f2(-Math.log2(x))} bits` : '∞ bits', i + 0.5, x, C.gray, 'center', 0, -4);
      P.text('ABCD'[i], i + 0.5, 0, C.ink, 'center', 0, 16);
    });
    P.rect(0.15, -0.28, 0.15 + 3.7 * H / 2, -0.18, C.purple, null); P.rect(0.15, -0.28, 3.85, -0.18, null, C.gray);
    P.text(`H = ${f2(H)} bits (max 2)`, 0.15, -0.18, C.purple, 'left', 0, -6);
    o.innerHTML = `H(p) = −Σ p log₂ p = <b>${f2(H)} bits</b> = ${f2(H * Math.LN2)} nats`;
  };
};

V.kl = box => {
  const xs = range(601).map(i => -7 + 14 * i / 600), dx = 14 / 600;
  const lp = x => { const a = -((x + 2) ** 2) / 0.72, b = -((x - 2) ** 2) / 0.72, m = Math.max(a, b); return m + Math.log(Math.exp(a - m) + Math.exp(b - m)) + Math.log(0.5 / (0.6 * Math.sqrt(2 * Math.PI))); };
  const LP = xs.map(lp);
  const lq = (x, m, s) => -((x - m) ** 2) / (2 * s * s) - Math.log(s * Math.sqrt(2 * Math.PI));
  const kl = (m, s) => { let a = 0, b = 0; xs.forEach((x, i) => { const q = lq(x, m, s), p = LP[i]; a += Math.exp(p) * (p - q) * dx; b += Math.exp(q) * (q - p) * dx; }); return [a, b]; };
  const fit = k => { let best = [1e9]; for (let m = -3; m <= 3; m += 0.05) for (let s = 0.2; s <= 4; s += 0.02) { const v = kl(m, s)[k]; if (v < best[0]) best = [v, m, s]; } mu.v = +best[1].toFixed(2); sg.v = +best[2].toFixed(2); };
  const c = canvas(box), P = plot(c, -7, 7, 0, 0.75);
  const r = row(box), mu = slider(r, 'μ of q', -3, 3, 0.05, 0.5), sg = slider(r, 'σ of q', 0.2, 4, 0.02, 1);
  const r2 = row(box); button(r2, 'Fit by min KL(p‖q)', () => fit(0)); button(r2, 'Fit by min KL(q‖p)', () => fit(1));
  const o = out(box);
  return () => {
    P.clear(); P.axes();
    P.path(xs.map((x, i) => [x, Math.exp(LP[i])]), C.blue, 2.5);
    P.fn(x => Math.exp(lq(x, mu.v, sg.v)), C.red, 2.5);
    const [a, b] = kl(mu.v, sg.v);
    o.innerHTML = `KL(p‖q) = <b>${f2(a)}</b> nats &nbsp; KL(q‖p) = <b>${f2(b)}</b> nats &nbsp; (the two directions disagree)`;
  };
};

V.softmax = box => {
  const c = canvas(box, 600, 260), P = plot(c, 0, 4, -0.12, 1.1);
  const r = row(box), z = [2, 1, 0.1, -1].map((v, i) => slider(r, `z${'₁₂₃₄'[i]}`, -5, 5, 0.1, v));
  const r2 = row(box), T = slider(r2, 'temperature T', 0.05, 5, 0.05, 1), off = slider(r2, 'offset added to all', 0, 1000, 1, 0);
  const o = out(box);
  return () => {
    const zz = z.map(q => (q.v + off.v) / T.v), m = Math.max(...zz), e = zz.map(v => Math.exp(v - m)), s = sum(e), p = e.map(v => v / s);
    const ne = zz.map(Math.exp), ns = sum(ne), np = ne.map(v => v / ns);
    P.clear();
    p.forEach((x, i) => { P.rect(i + 0.2, 0, i + 0.8, x, PAL[i] + '55', PAL[i]); P.text(f2(x), i + 0.5, x, C.ink, 'center', 0, -5); P.text(`z${'₁₂₃₄'[i]} = ${z[i].v}`, i + 0.5, 0, C.ink, 'center', 0, 16); });
    o.innerHTML = `stable (subtract max): [${p.map(f2).join(', ')}], log Σ e<sup>z/T</sup> = ${f2(m + Math.log(s))}<br>naive: Σ e<sup>z/T</sup> = ${ns === Infinity ? '<b style="color:#c0392b">Infinity</b>' : f2(ns)} → [${np.map(v => (isNaN(v) ? '<b style="color:#c0392b">NaN</b>' : f2(v))).join(', ')}]`;
  };
};

V.montecarlo = box => {
  const c = canvas(box, 600, 300), { ctx } = c;
  let rnd = rng(9), N = 0, inside = 0, pts = [], hist = [];
  const add = k => { for (let i = 0; i < k; i++) { const x = rnd() * 2 - 1, y = rnd() * 2 - 1, a = x * x + y * y <= 1; N++; inside += a; if (pts.length < 6000) pts.push([x, y, a]); } hist.push([N, 4 * inside / N]); };
  const r = row(box);
  button(r, '+100', () => add(100)); button(r, '+1,000', () => add(1000)); button(r, '+10,000', () => add(10000));
  button(r, 'Reset', () => { rnd = rng(Math.floor(Math.random() * 1e6) + 1); N = inside = 0; pts = []; hist = []; });
  const auto = check(r, 'auto', false);
  const o = out(box);
  const Q = { X: n => 330 + (Math.log10(n) - 1) / 4 * 255, Y: v => 280 - (v - 2.6) / 1.1 * 260 };
  const draw = () => {
    ctx.clearRect(0, 0, 600, 300);
    ctx.strokeStyle = C.ink; ctx.strokeRect(10, 10, 280, 280);
    ctx.beginPath(); ctx.arc(150, 150, 140, 0, 7); ctx.stroke();
    pts.forEach(([x, y, a]) => { ctx.fillStyle = a ? C.blue : C.red; ctx.fillRect(150 + x * 140 - 1, 150 - y * 140 - 1, 2, 2); });
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath();
    for (let i = 0; i <= 100; i++) { const n = 10 ** (1 + 4 * i / 100); ctx.lineTo(Q.X(n), Q.Y(Math.PI + 2 * 4 * Math.sqrt(0.785 * 0.215 / n))); }
    for (let i = 100; i >= 0; i--) { const n = 10 ** (1 + 4 * i / 100); ctx.lineTo(Q.X(n), Q.Y(Math.PI - 2 * 4 * Math.sqrt(0.785 * 0.215 / n))); }
    ctx.fill();
    ctx.strokeStyle = C.red; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(330, Q.Y(Math.PI)); ctx.lineTo(585, Q.Y(Math.PI)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.beginPath(); hist.filter(h => h[0] >= 10).forEach(([n, v], i) => (i ? ctx.lineTo(Q.X(n), Q.Y(Math.max(2.6, Math.min(3.7, v)))) : ctx.moveTo(Q.X(n), Q.Y(Math.max(2.6, Math.min(3.7, v)))))); ctx.stroke();
    ctx.fillStyle = C.gray; ctx.font = '12px Times New Roman'; ctx.textAlign = 'center';
    [10, 100, 1e3, 1e4, 1e5].forEach(n => ctx.fillText(n >= 1e3 ? n / 1e3 + 'k' : n, Q.X(n), 296));
    ctx.textAlign = 'left'; ctx.fillText('π', 590 - 10, Q.Y(Math.PI) - 4); ctx.font = FONT;
    o.innerHTML = N ? `N = ${N.toLocaleString()}, inside = ${inside.toLocaleString()}, estimate 4·inside/N = <b>${(4 * inside / N).toFixed(4)}</b>, error = ${f2(4 * inside / N - Math.PI)}, expected size ≈ ${f2(4 * Math.sqrt(0.785 * 0.215 / N))}` : 'Add points to start.';
  };
  loop(box, () => { if (auto.v && N < 100000) { add(N < 1000 ? 20 : 400); draw(); } });
  return draw;
};

V.markov = box => {
  const names = ['Sunny', 'Cloudy', 'Rainy'], pos = [[140, 60], [55, 225], [225, 225]];
  const c = canvas(box, 600, 300), { ctx } = c;
  const r = row(box), st = names.map((n, i) => slider(r, `P(stay | ${n})`, 0, 0.95, 0.05, [0.7, 0.4, 0.5][i]));
  const r2 = row(box); let hist = [[1, 0, 0]];
  names.forEach((n, i) => button(r2, `Start ${n}`, () => (hist = [[0, 1, 2].map(j => +(j === i))])));
  button(r2, 'Step', () => step());
  const auto = check(r2, 'auto', false);
  const M = () => st.map((s, i) => [0, 1, 2].map(j => (i === j ? s.v : (1 - s.v) / 2)));
  const step = () => { if (hist.length > 40) return; const p = hist[hist.length - 1], T = M(); hist.push([0, 1, 2].map(j => sum([0, 1, 2].map(i => p[i] * T[i][j])))); };
  const o = out(box);
  const draw = () => {
    const T = M(); let s = [1 / 3, 1 / 3, 1 / 3];
    for (let k = 0; k < 500; k++) s = [0, 1, 2].map(j => sum([0, 1, 2].map(i => s[i] * T[i][j])));
    ctx.clearRect(0, 0, 600, 300); ctx.font = '13px Times New Roman';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (i !== j) {
      const [x1, y1] = pos[i], [x2, y2] = pos[j], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, ox = -uy * 7, oy = ux * 7;
      parrow(ctx, x1 + ux * 34 + ox, y1 + uy * 34 + oy, x2 - ux * 34 + ox, y2 - uy * 34 + oy, C.gray, 1.2 + 3 * T[i][j]);
      ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(f2(T[i][j]), (x1 + x2) / 2 + ox * 3, (y1 + y2) / 2 + oy * 3 + 4);
    }
    const cur = hist[hist.length - 1];
    pos.forEach(([x, y], i) => {
      ctx.fillStyle = PAL[i] + '22'; ctx.strokeStyle = PAL[i]; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 32, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = PAL[i]; ctx.textAlign = 'center'; ctx.fillText(names[i], x, y - 2); ctx.fillText(f2(cur[i]), x, y + 14);
      ctx.fillStyle = C.gray; ctx.fillText(`stay ${f2(T[i][i])}`, x, y + (i ? 48 : -40));
    });
    const X = t => 320 + t / 40 * 265, Y = v => 270 - v * 250;
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 1; ctx.strokeRect(320, 20, 265, 250);
    [0, 1, 2].forEach(i => {
      ctx.strokeStyle = PAL[i]; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(320, Y(s[i])); ctx.lineTo(585, Y(s[i])); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 2; ctx.beginPath(); hist.forEach((p, t) => (t ? ctx.lineTo(X(t), Y(p[i])) : ctx.moveTo(X(t), Y(p[i])))); ctx.stroke(); ctx.lineWidth = 1;
    });
    ctx.fillStyle = C.gray; ctx.textAlign = 'left'; ctx.fillText('π_t over 40 steps (dashed: π*)', 322, 14); ctx.font = FONT;
    o.innerHTML = `step t = ${hist.length - 1}: π_t = [${cur.map(f2).join(', ')}] &nbsp; stationary π* = [<b>${s.map(f2).join(', ')}</b>]`;
  };
  let acc = 0;
  loop(box, dt => { if (auto.v && (acc += dt) > 0.25 && hist.length <= 40) { acc = 0; step(); draw(); } });
  return draw;
};

/* ---------- Part II: a shared 2D classification playground ---------- */
const DATA = {
  'separable blobs': (r, n) => range(n).map(i => { const k = i % 2; return [(k ? 0.5 : -0.5) + 0.17 * gauss(r), (k ? 0.3 : -0.3) + 0.17 * gauss(r), k]; }),
  'two blobs': (r, n) => range(n).map(i => { const k = i % 2; return [(k ? 0.45 : -0.45) + 0.28 * gauss(r), (k ? 0.25 : -0.25) + 0.28 * gauss(r), k]; }),
  'three blobs': (r, n) => range(n).map(i => { const k = i % 3, a = k * 2.1 + 0.4; return [0.55 * Math.cos(a) + 0.2 * gauss(r), 0.5 * Math.sin(a) + 0.2 * gauss(r), k]; }),
  moons: (r, n) => range(n).map(i => { const k = i % 2, t = Math.PI * r(); const [x, y] = k ? [1 - Math.cos(t), 0.5 - Math.sin(t)] : [Math.cos(t), Math.sin(t)]; return [(x - 0.5) * 0.65 + 0.07 * gauss(r), (y - 0.25) * 0.75 + 0.07 * gauss(r), k]; }),
  circles: (r, n) => range(n).map(i => { const k = i % 2, a = 2 * Math.PI * r(), R = (k ? 0.75 : 0.3) + 0.07 * gauss(r); return [R * Math.cos(a), R * Math.sin(a), k]; }),
  xor: (r, n) => range(n).map(() => { let x, y; do { x = r() * 1.8 - 0.9; y = r() * 1.8 - 0.9; } while (Math.abs(x) < 0.08 || Math.abs(y) < 0.08); return [x, y, +(x * y > 0)]; }),
  spiral: (r, n) => range(n).map(i => { const k = i % 2, t = 0.12 + 0.88 * (i >> 1) / (n / 2), a = 3.4 * Math.PI * t + k * Math.PI + 0.12 * gauss(r); return [0.85 * t * Math.cos(a), 0.85 * t * Math.sin(a), k]; }),
};
const RGB = [[31, 95, 191], [192, 57, 43], [46, 139, 87]];
const soft = z => { const m = Math.max(...z), e = z.map(v => Math.exp(v - m)), s = sum(e); return e.map(v => v / s); };

// M: { ctl(row), fit(D) or reset(D)+step(D), prob(x, y) -> class probabilities, info(), extra(P, D) }
function playground(box, M, o = {}) {
  const c = canvas(box, 600, 380), P = plot(c, -1.6, 1.6, -1.03, 1.03);
  const r = row(box), ds = select(r, 'data', o.sets || Object.keys(DATA), o.set || 'two blobs');
  let seed = 1, key = null, running = false, epoch = 0;
  const D = { X: [], Y: [], K: 2 };
  button(r, 'New sample', () => { seed++; key = null; });
  if (M.ctl) M.ctl(row(box));
  if (M.step) {
    const tr = row(box);
    button(tr, 'Train / pause', () => (running = !running));
    button(tr, 'Step', () => { M.step(D); epoch++; });
    button(tr, 'Reset model', () => { M.reset(D); epoch = 0; });
  }
  onClick(P, (x, y, e) => {
    if (D.X.some(([a, b]) => Math.hypot(P.X(a) - P.X(x), P.Y(b) - P.Y(y)) < 8)) return;
    D.X.push([x, y]); D.Y.push(e.shiftKey ? 1 : 0);
  });
  const ot = out(box);
  const draw = () => {
    if (key !== ds.v + seed) {
      key = ds.v + seed;
      const pts = DATA[ds.v](rng(seed * 7 + 3), o.n || 140);
      D.X = pts.map(p => [p[0], p[1]]); D.Y = pts.map(p => p[2]); D.K = 1 + Math.max(...D.Y);
      if (M.reset) M.reset(D);
      epoch = 0; running = false;
    }
    if (M.fit) M.fit(D);
    const { ctx } = c, cell = 6;
    ctx.clearRect(0, 0, 600, 380);
    for (let px = 0; px < 600; px += cell) for (let py = 0; py < 380; py += cell) {
      const p = M.prob(P.ix(px + cell / 2), P.iy(py + cell / 2));
      let k = 0; p.forEach((v, j) => { if (v > p[k]) k = j; });
      const conf = D.K > 1 ? Math.max(0, (p[k] - 1 / D.K) / (1 - 1 / D.K)) : 1, a = 0.12 + 0.38 * conf;
      ctx.fillStyle = `rgba(${RGB[k][0]},${RGB[k][1]},${RGB[k][2]},${a})`; ctx.fillRect(px, py, cell, cell);
    }
    if (M.extra) M.extra(P, D);
    let ok = 0;
    D.X.forEach(([x, y], i) => {
      const p = M.prob(x, y); if (p.indexOf(Math.max(...p)) === D.Y[i]) ok++;
      ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), 4.5, 0, 7); ctx.fillStyle = `rgb(${RGB[D.Y[i]]})`; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
    });
    ot.innerHTML = (M.step ? `epoch ${epoch} &nbsp; ` : '') + `training accuracy = <b>${(100 * ok / D.X.length).toFixed(1)}%</b> &nbsp; ` + (M.info ? M.info(D) : '');
  };
  let acc = 0;
  loop(box, dt => { if (running && (acc += dt) >= (o.dt || 0)) { acc = 0; for (let i = 0; i < (o.spe || 4); i++) { M.step(D); epoch++; } draw(); } });
  return draw;
}

/* ---------- Part II, chapters 9 and 10 (first half) ---------- */
V.metrics = box => {
  const c = canvas(box, 600, 230), P = plot(c, -4, 8, 0, 0.45), c2 = canvas(box, 600, 250), { ctx } = c2;
  const r = row(box), sep = slider(r, 'separation', 0, 4, 0.05, 1.8), t = slider(r, 'threshold', -3, 6, 0.05, 1);
  const o = out(box);
  return () => {
    const d = sep.v, th = t.v, TPR = 1 - Phi(th - d), FPR = 1 - Phi(th);
    const TP = Math.round(500 * TPR), FN = 500 - TP, FP = Math.round(500 * FPR), TN = 500 - FP;
    P.clear(); P.axes(false);
    const area = (m, a, b, col) => P.path([[a, 0], ...range(61).map(i => { const x = a + (b - a) * i / 60; return [x, normPdf(x, m, 1)]; }), [b, 0]], null, 1, true, col);
    area(0, th, 8, 'rgba(212,128,15,.45)'); area(d, -4, th, 'rgba(120,120,120,.35)'); area(d, th, 8, 'rgba(192,57,43,.3)');
    P.fn(x => normPdf(x, 0, 1), C.blue, 2); P.fn(x => normPdf(x, d, 1), C.red, 2);
    P.seg(th, 0, th, 0.45, C.ink, 2); P.text('threshold', th, 0.43, C.ink, 'left', 4);
    P.text('negatives', 0, normPdf(0, 0, 1), C.blue, 'center', 0, -6); P.text('positives', d, normPdf(0, 0, 1), C.red, 'center', 0, 14);
    ctx.clearRect(0, 0, 600, 250);
    const X = v => 50 + v * 180, Y = v => 220 - v * 180;
    ctx.strokeStyle = '#ccc'; ctx.strokeRect(50, 40, 180, 180);
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = C.purple; ctx.lineWidth = 2; ctx.beginPath();
    range(201).forEach(i => { const s = 8 - 12 * i / 200, fx = X(1 - Phi(s)), fy = Y(1 - Phi(s - d)); i ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(X(FPR), Y(TPR), 5, 0, 7); ctx.fill();
    ctx.font = '13px Times New Roman'; ctx.textAlign = 'center'; ctx.fillText('false positive rate', 140, 240); ctx.fillText('ROC curve', 140, 30);
    ctx.save(); ctx.translate(30, 130); ctx.rotate(-Math.PI / 2); ctx.fillText('true positive rate', 0, 0); ctx.restore();
    const cells = [['TP', TP, 'rgba(192,57,43,.3)'], ['FN', FN, 'rgba(120,120,120,.3)'], ['FP', FP, 'rgba(212,128,15,.45)'], ['TN', TN, '#f2f2f2']];
    ctx.textAlign = 'center'; ctx.fillText('predicted +', 380, 40); ctx.fillText('predicted −', 490, 40);
    ctx.textAlign = 'right'; ctx.fillText('actual +', 322, 95); ctx.fillText('actual −', 322, 175);
    cells.forEach(([n, v, col], i) => { const x = 330 + (i % 2) * 110, y = 50 + Math.floor(i / 2) * 80; ctx.fillStyle = col; ctx.fillRect(x, y, 105, 75); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.font = FONT; ctx.fillText(`${n} = ${v}`, x + 52, y + 42); });
    ctx.font = FONT;
    const pr = TP / (TP + FP || 1), rc = TP / 500;
    o.innerHTML = `accuracy = ${pct((TP + TN) / 1000)} &nbsp; precision = ${pct(pr)} &nbsp; recall = ${pct(rc)} &nbsp; F₁ = ${f2(2 * pr * rc / (pr + rc || 1))} &nbsp; FPR = ${pct(FPR)} &nbsp; <b>AUC = ${f2(Phi(d / Math.SQRT2))}</b>`;
  };
};

V.scaling = box => {
  const c = canvas(box, 600, 380), P = plot(c, -2.53, 2.53, -1.6, 1.6);
  const r = row(box), eta = slider(r, 'learning rate η', 0.01, 1.2, 0.01, 0.07), std = check(r, 'standardize', false);
  const o = out(box);
  let key, bg;
  return () => {
    const s2 = std.v ? 1 : 25, opt = std.v ? [1.5, 1.2] : [1.5, 0.24], L = (a, b) => 0.5 * ((a - opt[0]) ** 2 + s2 * (b - opt[1]) ** 2);
    if (key !== std.v) { key = std.v; bg = field(P, L, 0, std.v ? 8 : 40, 18); }
    let w = [-2, -1.3]; const path = [w]; let k = 0;
    for (; k < 200 && L(...w) > 1e-3 && Math.abs(w[0]) + Math.abs(w[1]) < 1e3; k++) { w = [w[0] - eta.v * (w[0] - opt[0]), w[1] - eta.v * s2 * (w[1] - opt[1])]; path.push(w); }
    P.clear(); bg();
    P.path(path.slice(0, 80).map(([a, b]) => [a, Math.max(-5, Math.min(5, b))]), C.orange, 1.5);
    path.slice(0, 80).forEach(([a, b]) => P.dot(a, b, 2.5, C.orange));
    P.dot(opt[0], opt[1], 5, C.ink);
    const div = Math.abs(w[0]) + Math.abs(w[1]) >= 1e3;
    o.innerHTML = (std.v ? 'standardized: curvature 1 and 1' : 'unscaled: curvature 1 along w₁, 25 along w₂') + ` &nbsp; stable for η &lt; 2/λ<sub>max</sub> = ${f2(2 / s2)} &nbsp; ` +
      (div ? '<b style="color:#c0392b">diverged</b>' : k >= 200 ? 'still not converged after 200 steps' : `<b>converged in ${k} steps</b>`);
  };
};

V.linreg = box => {
  const c = canvas(box, 600, 400), P = plot(c, 0, 10, 0, 6.32);
  const pts = [[1, 1.2], [2, 1.9], [3, 1.6], [4.2, 3.1], [5.5, 2.9], [6.5, 4.2], [7.6, 4], [8.8, 5.1]].map(([x, y]) => ({ x, y }));
  drag(P, pts);
  onClick(P, (x, y) => { if (!pts.some(p => Math.hypot(P.X(p.x) - P.X(x), P.Y(p.y) - P.Y(y)) < 18)) pts.push({ x, y }); });
  const r = row(box), w = slider(r, 'your slope w', -1, 2, 0.01, 0.3), b = slider(r, 'your intercept b', -2, 5, 0.05, 2);
  const o = out(box);
  return () => {
    const n = pts.length, mx = sum(pts.map(p => p.x)) / n, my = sum(pts.map(p => p.y)) / n;
    const vx = sum(pts.map(p => (p.x - mx) ** 2)), cxy = sum(pts.map(p => (p.x - mx) * (p.y - my)));
    const W = cxy / (vx || 1), B = my - W * mx, mse = (a, c0) => sum(pts.map(p => (p.y - a * p.x - c0) ** 2)) / n;
    const r2 = 1 - mse(W, B) * n / (sum(pts.map(p => (p.y - my) ** 2)) || 1);
    P.clear(); P.axes();
    pts.forEach(p => { const e = p.y - (W * p.x + B), s = Math.abs(e), x2 = p.x + s <= 10 ? p.x + s : p.x - s; P.rect(Math.min(p.x, x2), Math.min(p.y, p.y - e), Math.max(p.x, x2), Math.max(p.y, p.y - e), 'rgba(31,95,191,.12)', 'rgba(31,95,191,.5)'); });
    P.fn(x => w.v * x + b.v, C.orange, 2, [6, 4]); P.fn(x => W * x + B, C.blue, 2.5);
    pts.forEach(p => P.dot(p.x, p.y, 6, C.ink));
    o.innerHTML = `<span style="color:${C.blue}">least squares: ŷ = ${f2(W)}x + ${f2(B)}, MSE = <b>${f2(mse(W, B))}</b>, R² = ${f2(r2)}</span><br><span style="color:${C.orange}">your line: MSE = ${f2(mse(w.v, b.v))}</span>`;
  };
};

V.ridge = box => {
  const w0 = [2, 0.7], A = [[1, 0.5], [0.5, 1]], L = (a, b) => { const u = a - w0[0], v = b - w0[1]; return A[0][0] * u * u + 2 * A[0][1] * u * v + A[1][1] * v * v; };
  const c = canvas(box, 600, 380), P = plot(c, -3.16, 3.16, -2, 2), bg = field(P, L, 0, 14, 16);
  const r = row(box), kind = select(r, 'penalty', ['L1 (Lasso)', 'L2 (Ridge)']), t = slider(r, 'budget t', 0.1, 3, 0.05, 1.2);
  const o = out(box);
  const norm = (a, b, l1) => (l1 ? Math.abs(a) + Math.abs(b) : Math.hypot(a, b));
  const best = (tt, l1) => {
    if (norm(...w0, l1) <= tt) return w0;
    let bw = null, bl = 1e9;
    for (let i = 0; i < 4000; i++) { const a = 2 * Math.PI * i / 4000, cs = Math.cos(a), sn = Math.sin(a), s = tt / norm(cs, sn, l1), v = L(s * cs, s * sn); if (v < bl) { bl = v; bw = [s * cs, s * sn]; } }
    return bw;
  };
  return () => {
    const l1 = kind.v[1] === '1', w = best(t.v, l1);
    P.clear(); bg();
    const reg = range(201).map(i => { const a = 2 * Math.PI * i / 200, cs = Math.cos(a), sn = Math.sin(a), s = t.v / norm(cs, sn, l1); return [s * cs, s * sn]; });
    P.path(reg, C.ink, 2, true, 'rgba(255,255,255,.55)');
    P.path(range(31).map(i => best(0.1 + i * 0.1, l1)), C.red, 1, false); 
    P.seg(-3.2, 0, 3.2, 0, '#666'); P.seg(0, -2, 0, 2, '#666');
    P.text('w₁', 3.0, 0, C.ink, 'right', 0, -6); P.text('w₂', 0, 1.9, C.ink, 'left', 6);
    P.seg(w0[0] - 0.1, w0[1] - 0.1, w0[0] + 0.1, w0[1] + 0.1, C.ink, 2); P.seg(w0[0] - 0.1, w0[1] + 0.1, w0[0] + 0.1, w0[1] - 0.1, C.ink, 2);
    P.dot(w[0], w[1], 6, C.red);
    o.innerHTML = `solution w = (${f2(w[0])}, ${f2(w[1])}) &nbsp; loss = ${f2(L(...w))} &nbsp; ` + (Math.abs(w[1]) < 0.01 ? '<b>w₂ = 0: Lasso dropped feature 2</b>' : 'both weights nonzero') + ' &nbsp; (thin red line: the solution as t grows)';
  };
};

V.logreg = box => {
  let W, lr, l2, loss;
  return playground(box, {
    ctl(r) { lr = slider(r, 'learning rate', 0.05, 3, 0.05, 1); l2 = slider(r, 'L2 λ', 0, 0.1, 0.001, 0.001); },
    reset(D) { W = range(D.K).map(() => [0, 0, 0]); loss = null; },
    step(D) {
      const G = W.map(() => [0, 0, 0]); let l = 0;
      D.X.forEach(([x, y], i) => { const p = soft(W.map(w => w[0] * x + w[1] * y + w[2])); l -= Math.log(p[D.Y[i]] + 1e-12); p.forEach((pk, k) => { const g = pk - (D.Y[i] === k); G[k][0] += g * x; G[k][1] += g * y; G[k][2] += g; }); });
      const n = D.X.length; W.forEach((w, k) => { for (let j = 0; j < 3; j++) w[j] -= lr.v * (G[k][j] / n + (j < 2 ? l2.v * w[j] : 0)); }); loss = l / n;
    },
    prob: (x, y) => soft(W.map(w => w[0] * x + w[1] * y + w[2])),
    info: () => (loss == null ? 'press Train' : `cross-entropy loss = ${f2(loss)}, ‖w‖ = ${f2(Math.hypot(...W.flatMap(w => w.slice(0, 2))))}`),
  }, { sets: ['two blobs', 'three blobs', 'moons', 'xor'] });
};

/* ---------- Part II, chapter 10 (second half) and chapter 11 ---------- */
// CART classification tree on 2D points. feats(r) picks the candidate features at each split.
function growTree(X, Y, idx, K, depth, o) {
  const counts = new Array(K).fill(0); idx.forEach(i => counts[Y[i]]++);
  const n = idx.length, node = { p: counts.map(c => c / n) };
  if (depth >= o.maxD || n < 2 * o.minLeaf || Math.max(...counts) === n) return node;
  const imp = c => { const t = sum(c); return !t ? 0 : o.crit === 'entropy' ? -sum(c.map(v => (v ? (v / t) * Math.log2(v / t) : 0))) : 1 - sum(c.map(v => (v / t) ** 2)); };
  const base = imp(counts);
  let best = null;
  for (const f of o.feats ? o.feats() : [0, 1]) {
    const s = idx.slice().sort((a, b) => X[a][f] - X[b][f]), L = new Array(K).fill(0), R = counts.slice();
    for (let j = 0; j < n - 1; j++) {
      L[Y[s[j]]]++; R[Y[s[j]]]--;
      if (X[s[j]][f] === X[s[j + 1]][f] || j + 1 < o.minLeaf || n - j - 1 < o.minLeaf) continue;
      const g = base - ((j + 1) * imp(L) + (n - j - 1) * imp(R)) / n;
      if (!best || g > best.g) best = { g, f, t: (X[s[j]][f] + X[s[j + 1]][f]) / 2 };
    }
  }
  if (!best || best.g <= 1e-12) return node;
  Object.assign(node, best);
  node.l = growTree(X, Y, idx.filter(i => X[i][best.f] <= best.t), K, depth + 1, o);
  node.r = growTree(X, Y, idx.filter(i => X[i][best.f] > best.t), K, depth + 1, o);
  return node;
}
const treeProb = (n, x) => { while (n.l) n = x[n.f] <= n.t ? n.l : n.r; return n.p; };
const leaves = n => (n.l ? leaves(n.l) + leaves(n.r) : 1);
function drawSplits(P, n, x0, x1, y0, y1) {
  if (!n.l) return;
  if (n.f === 0) { P.seg(n.t, y0, n.t, y1, C.ink, 1.5); drawSplits(P, n.l, x0, n.t, y0, y1); drawSplits(P, n.r, n.t, x1, y0, y1); }
  else { P.seg(x0, n.t, x1, n.t, C.ink, 1.5); drawSplits(P, n.l, x0, x1, y0, n.t); drawSplits(P, n.r, x0, x1, n.t, y1); }
}
// 1D regression tree minimizing squared error; returns x => prediction.
function regTree(xs, ys, depth) {
  const n = xs.length, m = sum(ys) / (n || 1);
  if (depth === 0 || n < 4) return () => m;
  const o = range(n).sort((a, b) => xs[a] - xs[b]), tot = sum(ys);
  let best = null, sl = 0;
  for (let j = 0; j < n - 1; j++) {
    sl += ys[o[j]];
    if (j < 1 || n - j - 1 < 2 || xs[o[j]] === xs[o[j + 1]]) continue;
    const score = sl * sl / (j + 1) + (tot - sl) ** 2 / (n - j - 1);
    if (!best || score > best.s) best = { s: score, t: (xs[o[j]] + xs[o[j + 1]]) / 2 };
  }
  if (!best) return () => m;
  const L = range(n).filter(i => xs[i] <= best.t), R = range(n).filter(i => xs[i] > best.t);
  const fl = regTree(L.map(i => xs[i]), L.map(i => ys[i]), depth - 1), fr = regTree(R.map(i => xs[i]), R.map(i => ys[i]), depth - 1);
  return x => (x <= best.t ? fl(x) : fr(x));
}

V.knn = box => {
  let k, wt, D0;
  return playground(box, {
    ctl(r) { k = slider(r, 'k', 1, 41, 2, 1); wt = check(r, 'weight votes by 1/distance', false); },
    fit(D) { D0 = D; },
    prob(x, y) {
      const K = Math.min(k.v, D0.X.length), bd = [], bi = [];
      D0.X.forEach(([a, b], i) => {
        const d = (a - x) ** 2 + (b - y) ** 2;
        if (bd.length === K && d >= bd[K - 1]) return;
        let j = bd.length === K ? K - 1 : bd.length; while (j > 0 && bd[j - 1] > d) { bd[j] = bd[j - 1]; bi[j] = bi[j - 1]; j--; }
        bd[j] = d; bi[j] = i;
      });
      const v = new Array(D0.K).fill(0); bi.forEach((i, j) => (v[D0.Y[i]] += wt.v ? 1 / (Math.sqrt(bd[j]) + 1e-3) : 1));
      const s = sum(v); return v.map(q => q / s);
    },
    info: () => `k = ${k.v}`,
  }, { sets: ['two blobs', 'moons', 'circles', 'xor', 'spiral', 'three blobs'], set: 'moons' });
};

V.nbayes = box => {
  let S;
  return playground(box, {
    fit(D) {
      S = range(D.K).map(k => {
        const P = D.X.filter((_, i) => D.Y[i] === k), n = P.length, m = [0, 1].map(j => sum(P.map(p => p[j])) / n);
        return { prior: n / D.X.length, m, v: [0, 1].map(j => sum(P.map(p => (p[j] - m[j]) ** 2)) / n + 1e-3) };
      });
    },
    prob: (x, y) => soft(S.map(s => Math.log(s.prior) - ((x - s.m[0]) ** 2) / (2 * s.v[0]) - ((y - s.m[1]) ** 2) / (2 * s.v[1]) - 0.5 * Math.log(s.v[0] * s.v[1]))),
    extra(P) { S.forEach((s, k) => [1, 2].forEach(q => P.path(range(61).map(i => [s.m[0] + q * Math.sqrt(s.v[0]) * Math.cos(i * Math.PI / 30), s.m[1] + q * Math.sqrt(s.v[1]) * Math.sin(i * Math.PI / 30)]), `rgb(${RGB[k]})`, q === 1 ? 2 : 1, true))); },
    info: () => S.map((s, k) => `class ${k}: P(y) = ${f2(s.prior)}, μ = (${f2(s.m[0])}, ${f2(s.m[1])})`).join('; '),
  }, { sets: ['two blobs', 'three blobs', 'circles', 'moons'] });
};

V.svm = box => {
  let kern, C, gam, alpha, Km, T, sig, D0, rnd = rng(5);
  const kf = (a, b) => (kern.v === 'linear' ? a[0] * b[0] + a[1] * b[1] + 1 : Math.exp(-gam.v * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)));
  const lam = () => 1 / (10 ** C.v * D0.X.length), yy = i => (D0.Y[i] ? 1 : -1);
  const f = p => { if (!T) return 0; let s = 0; for (let j = 0; j < alpha.length; j++) if (alpha[j]) s += alpha[j] * yy(j) * kf(D0.X[j], p); return s / (lam() * T); };
  const M = {
    ctl(r) { kern = select(r, 'kernel', ['linear', 'RBF']); C = slider(r, 'C', -2, 2, 0.1, 0, v => (10 ** v).toPrecision(2)); gam = slider(r, 'γ (RBF)', 0.5, 40, 0.5, 6); },
    reset(D) { D0 = D; alpha = new Array(D.X.length).fill(0); T = 0; sig = kern.v + C.v + gam.v; Km = D.X.map(a => D.X.map(b => kf(a, b))); },
    step(D) {
      if (sig !== kern.v + C.v + gam.v || alpha.length !== D.X.length) M.reset(D);
      const n = D.X.length;
      for (let it = 0; it < 400; it++) {
        T++; const i = Math.floor(rnd() * n); let s = 0;
        for (let j = 0; j < n; j++) if (alpha[j]) s += alpha[j] * yy(j) * Km[j][i];
        if (yy(i) * s / (lam() * T) < 1) alpha[i]++;
      }
    },
    prob(x, y) { const p = sigmoid(2 * f([x, y])); return [1 - p, p]; },
    extra(P) {
      const { ctx } = P.c, cs = 4, G = [];
      for (let i = 0; i <= 150; i++) { G.push([]); for (let j = 0; j <= 95; j++) G[i].push(f([P.ix(i * cs), P.iy(j * cs)])); }
      for (let i = 0; i < 150; i++) for (let j = 0; j < 95; j++) {
        const a = G[i][j];
        [[G[i + 1][j], 0], [G[i][j + 1], 1]].forEach(([b]) => {
          if ((a > 0) !== (b > 0)) { ctx.fillStyle = C.ink; ctx.fillRect(i * cs, j * cs, 2.2, 2.2); }
          else if ((Math.abs(a) > 1) !== (Math.abs(b) > 1) && (i + j) % 2) { ctx.fillStyle = '#555'; ctx.fillRect(i * cs, j * cs, 1.5, 1.5); }
        });
      }
      if (T) D0.X.forEach((p, i) => { if (yy(i) * f(p) <= 1.0001) { ctx.beginPath(); ctx.arc(P.X(p[0]), P.Y(p[1]), 8, 0, 7); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke(); } });
    },
    info() {
      if (!T) return 'press Train';
      const nsv = D0.X.filter((p, i) => yy(i) * f(p) <= 1.0001).length;
      if (kern.v !== 'linear') return `${nsv} support vectors`;
      const w = [0, 1].map(k => sum(alpha.map((a, j) => a * yy(j) * D0.X[j][k])) / (lam() * T));
      return `${nsv} support vectors, margin width 2/‖w‖ = ${f2(2 / Math.hypot(...w))}`;
    },
  };
  return playground(box, M, { sets: ['two blobs', 'moons', 'circles', 'xor'], spe: 2 });
};

V.tree = box => {
  let depth, crit, minLeaf, root;
  return playground(box, {
    ctl(r) { depth = slider(r, 'max depth', 1, 10, 1, 2); crit = select(r, 'impurity', ['gini', 'entropy']); minLeaf = slider(r, 'min leaf size', 1, 20, 1, 1); },
    fit(D) { root = growTree(D.X, D.Y, range(D.X.length), D.K, 0, { maxD: depth.v, minLeaf: minLeaf.v, crit: crit.v }); },
    prob: (x, y) => treeProb(root, [x, y]),
    extra: P => drawSplits(P, root, -1.6, 1.6, -1.03, 1.03),
    info: () => `${leaves(root)} leaves`,
  }, { sets: ['two blobs', 'three blobs', 'moons', 'circles', 'xor', 'spiral'], set: 'moons' });
};

V.forest = box => {
  let B, depth, rf, trees, oob;
  return playground(box, {
    ctl(r) { B = slider(r, 'trees B', 1, 100, 1, 1); depth = slider(r, 'max depth', 1, 12, 1, 8); rf = check(r, 'random feature per split (m = 1)', true); },
    fit(D) {
      const r = rng(42), n = D.X.length, votes = D.X.map(() => new Array(D.K).fill(0));
      trees = range(B.v).map(() => {
        const idx = range(n).map(() => Math.floor(r() * n)), inb = new Set(idx);
        const t = growTree(D.X, D.Y, idx, D.K, 0, { maxD: depth.v, minLeaf: 1, crit: 'gini', feats: rf.v ? () => [r() < 0.5 ? 0 : 1] : null });
        D.X.forEach((p, i) => { if (!inb.has(i)) treeProb(t, p).forEach((v, k) => (votes[i][k] += v)); });
        return t;
      });
      let ok = 0, cnt = 0;
      votes.forEach((v, i) => { if (sum(v) > 0) { cnt++; if (v.indexOf(Math.max(...v)) === D.Y[i]) ok++; } });
      oob = cnt ? ok / cnt : NaN;
    },
    prob(x, y) { const p = trees.map(t => treeProb(t, [x, y])); return p[0].map((_, k) => sum(p.map(q => q[k])) / p.length); },
    info: () => `out-of-bag accuracy = <b>${isNaN(oob) ? 'n/a (add trees)' : pct(oob)}</b>`,
  }, { sets: ['moons', 'circles', 'spiral', 'xor', 'two blobs'], set: 'moons' });
};

V.gboost = box => {
  const rnd = rng(17), xs = range(60).map(() => rnd() * 6.28).sort((a, b) => a - b), ys = xs.map(x => Math.sin(x) + 0.3 * gauss(rnd)), y0 = sum(ys) / 60;
  const c = canvas(box), P = plot(c, 0, 6.28, -2, 2);
  const r = row(box), nu = slider(r, 'learning rate ν', 0.05, 1, 0.05, 0.3), dep = slider(r, 'tree depth', 1, 3, 1, 2);
  let trees = [];
  const F = x => y0 + sum(trees.map(([h, v]) => v * h(x)));
  const next = () => regTree(xs, ys.map((y, i) => y - F(xs[i])), dep.v);
  const add = k => { for (let i = 0; i < k; i++) trees.push([next(), nu.v]); };
  const r2 = row(box); button(r2, 'Add tree', () => add(1)); button(r2, 'Add 10', () => add(10)); button(r2, 'Reset', () => (trees = []));
  const o = out(box);
  return () => {
    P.clear(); P.axes();
    xs.forEach((x, i) => P.seg(x, F(x), x, ys[i], '#aaa', 1));
    const h = next();
    P.fn(x => F(x) + h(x), C.orange, 1.5, [5, 3]);
    P.fn(F, C.blue, 2.5);
    xs.forEach((x, i) => P.dot(x, ys[i], 3.5, C.ink));
    const mse = sum(ys.map((y, i) => (y - F(xs[i])) ** 2)) / 60;
    o.innerHTML = `${trees.length} trees &nbsp; training MSE = <b>${f2(mse)}</b> (noise level σ² = 0.09: going far below it means fitting noise)`;
  };
};

V.xgboost = box => {
  const rnd = rng(23), xs = range(30).map(() => 0.3 + rnd() * 9.4).sort((a, b) => a - b);
  const sets = {
    'squared loss': { y: xs.map(x => 1 + (x > 6 ? 2.4 : 0) + (x > 3 ? 0.7 : 0) + 0.45 * gauss(rnd)), gh: (y, yh) => [yh - y, 1], init: ys => sum(ys) / ys.length, yr: [-0.5, 5.5] },
    'log loss': { y: xs.map(x => +(x + 1.6 * gauss(rnd) > 5.5)), gh: (y, z) => { const p = sigmoid(z); return [p - y, p * (1 - p)]; }, init: () => 0, yr: [-0.3, 1.3] },
  };
  const c = canvas(box, 600, 300), P = plot(c, 0, 10, 0, 1), c2 = canvas(box, 600, 160), Q = plot(c2, 0, 10, 0, 1);
  const r = row(box), loss = select(r, 'loss', Object.keys(sets)), lam = slider(r, 'λ', 0, 20, 0.5, 1), gam = slider(r, 'γ', 0, 10, 0.1, 0);
  const sp = { x: 5, y: 0 };
  drag(P, [sp], p => { p.x = Math.max(0.2, Math.min(9.8, p.x)); });
  let gainAt;
  button(row(box), 'Best split', () => { let b = 0, bt = 5; for (let i = 0; i < 29; i++) { const t = (xs[i] + xs[i + 1]) / 2, g = gainAt(t); if (g > b || i === 0) { b = g; bt = t; } } sp.x = bt; });
  const o = out(box);
  return () => {
    const S = sets[loss.v], z0 = S.init(S.y), gh = S.y.map(y => S.gh(y, z0)), L = lam.v;
    const part = t => { const a = [0, 0, 0, 0]; xs.forEach((x, i) => { const k = x <= t ? 0 : 2; a[k] += gh[i][0]; a[k + 1] += gh[i][1]; }); return a; };
    gainAt = t => { const [GL, HL, GR, HR] = part(t); return 0.5 * (GL * GL / (HL + L) + GR * GR / (HR + L) - (GL + GR) ** 2 / (HL + HR + L)) - gam.v; };
    const [GL, HL, GR, HR] = part(sp.x), wl = -GL / (HL + L), wr = -GR / (HR + L), gain = gainAt(sp.x);
    [P.y0, P.y1] = S.yr; sp.y = S.yr[1] - 0.06 * (S.yr[1] - S.yr[0]);
    const show = z => (loss.v === 'log loss' ? sigmoid(z) : z);
    P.clear(); P.axes();
    P.seg(0, show(z0), 10, show(z0), C.gray, 1.5, [5, 4]);
    if (gain > 0) { P.seg(0, show(z0 + wl), sp.x, show(z0 + wl), C.orange, 3); P.seg(sp.x, show(z0 + wr), 10, show(z0 + wr), C.orange, 3); }
    xs.forEach((x, i) => P.dot(x, S.y[i], 4, x <= sp.x ? C.blue : C.red));
    P.seg(sp.x, S.yr[0], sp.x, S.yr[1], C.ink, 1.5, [3, 3]); P.dot(sp.x, sp.y, 7, C.ink);
    const gs = range(29).map(i => { const t = (xs[i] + xs[i + 1]) / 2; return [t, gainAt(t)]; }), mx = Math.max(1e-6, ...gs.map(g => g[1])), mn = Math.min(0, ...gs.map(g => g[1]));
    Q.y0 = mn - 0.05 * (mx - mn); Q.y1 = mx * 1.1; Q.clear(); Q.axes(false);
    Q.path(gs, C.purple, 2); gs.forEach(([t, g]) => Q.dot(t, g, 2.5, g > 0 ? C.purple : C.gray));
    Q.seg(sp.x, Q.y0, sp.x, Q.y1, C.ink, 1, [3, 3]); Q.text('gain of each threshold', 0.1, Q.y1, C.gray, 'left', 0, 14);
    o.innerHTML = `left: G<sub>L</sub> = ${f2(GL)}, H<sub>L</sub> = ${f2(HL)}, w<sub>L</sub> = −G/(H+λ) = <b>${f2(wl)}</b> &nbsp; right: G<sub>R</sub> = ${f2(GR)}, H<sub>R</sub> = ${f2(HR)}, w<sub>R</sub> = <b>${f2(wr)}</b><br>Gain = <b>${f2(gain)}</b> ` + (gain > 0 ? '→ split' : '→ no split (gain ≤ 0), the leaf stays whole') + (loss.v === 'log loss' ? ' &nbsp; (weights are in log-odds; the plot shows probabilities)' : '');
  };
};

/* ---------- Part II, chapters 12 and 13 ---------- */
const PAL8 = [...PAL, '#17becf', '#8c564b', '#bcbd22'];
function chol(A) {
  const n = A.length, L = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
  }
  return L;
}
const fwd = (L, b) => { const x = []; b.forEach((v, i) => { let s = v; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x[i] = s / L[i][i]; }); return x; };
const bwd = (L, b) => { const n = b.length, x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; };
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

V.kmeans = box => {
  const sets = {
    'four blobs': r => range(200).map(i => { const c = [[-0.8, 0.5], [0.7, 0.55], [-0.5, -0.55], [0.8, -0.45]][i % 4]; return [c[0] + 0.2 * gauss(r), c[1] + 0.17 * gauss(r)]; }),
    'uneven sizes': r => range(200).map(i => (i % 5 ? [-0.5 + 0.45 * gauss(r), 0.35 * gauss(r)] : [1 + 0.1 * gauss(r), 0.6 + 0.1 * gauss(r)])),
    'rings (fails)': r => range(200).map(i => { const R = i % 2 ? 0.85 : 0.3, a = 6.283 * r(); return [R * Math.cos(a) + 0.05 * gauss(r), R * Math.sin(a) + 0.05 * gauss(r)]; }),
  };
  const c = canvas(box, 600, 380), P = plot(c, -1.6, 1.6, -1.03, 1.03);
  const r = row(box), ds = select(r, 'data', Object.keys(sets)), k = slider(r, 'k', 1, 8, 1, 4);
  let X = [], cen = [], asg = [], phase = 'assign', it = 0, key, run = false, rs = rng(3);
  const J = () => sum(X.map((p, i) => (asg[i] < 0 ? 0 : (p[0] - cen[asg[i]][0]) ** 2 + (p[1] - cen[asg[i]][1]) ** 2)));
  const near = p => { let b = 0; cen.forEach((q, j) => { if ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < (p[0] - cen[b][0]) ** 2 + (p[1] - cen[b][1]) ** 2) b = j; }); return b; };
  const init = pp => {
    cen = [X[Math.floor(rs() * X.length)].slice()];
    while (cen.length < k.v) {
      if (!pp) { cen.push(X[Math.floor(rs() * X.length)].slice()); continue; }
      const d = X.map(p => { const q = cen[near(p)]; return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; }), t = rs() * sum(d);
      let a = 0, i = 0; while (i < X.length - 1 && (a += d[i]) < t) i++; cen.push(X[i].slice());
    }
    asg = X.map(() => -1); phase = 'assign'; it = 0; run = false;
  };
  const step = () => {
    if (phase === 'assign') { const old = asg.join(); asg = X.map(near); phase = 'update'; if (old === asg.join()) run = false; }
    else { cen = cen.map((q, j) => { const m = X.filter((_, i) => asg[i] === j); return m.length ? [sum(m.map(p => p[0])) / m.length, sum(m.map(p => p[1])) / m.length] : q; }); phase = 'assign'; it++; }
  };
  const r2 = row(box);
  button(r2, 'Step', step); button(r2, 'Run / pause', () => (run = !run)); button(r2, 'Random start', () => init(false)); button(r2, 'k-means++ start', () => init(true));
  const o = out(box);
  let acc = 0;
  const draw = () => {
    if (key !== ds.v + k.v) { key = ds.v + k.v; X = sets[ds.v](rng(11)); init(false); }
    const { ctx } = c; ctx.clearRect(0, 0, 600, 380);
    for (let px = 0; px < 600; px += 6) for (let py = 0; py < 380; py += 6) { ctx.fillStyle = PAL8[near([P.ix(px + 3), P.iy(py + 3)])] + '22'; ctx.fillRect(px, py, 6, 6); }
    X.forEach((p, i) => { const q = asg[i]; ctx.fillStyle = q < 0 ? '#999' : PAL8[q]; ctx.beginPath(); ctx.arc(P.X(p[0]), P.Y(p[1]), 3.2, 0, 7); ctx.fill(); });
    cen.forEach((q, j) => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; P.seg(q[0] - 0.05, q[1] - 0.05, q[0] + 0.05, q[1] + 0.05, '#fff', 6); P.seg(q[0] - 0.05, q[1] + 0.05, q[0] + 0.05, q[1] - 0.05, '#fff', 6); P.seg(q[0] - 0.05, q[1] - 0.05, q[0] + 0.05, q[1] + 0.05, PAL8[j], 3); P.seg(q[0] - 0.05, q[1] + 0.05, q[0] + 0.05, q[1] - 0.05, PAL8[j], 3); });
    o.innerHTML = `iteration ${it}, next step: <b>${phase}</b> &nbsp; J = ${asg[0] < 0 ? '(assign first)' : f2(J())}`;
  };
  loop(box, dt => { if (run && (acc += dt) > 0.35) { acc = 0; step(); draw(); } });
  return draw;
};

V.gmm = box => {
  const r0 = rng(31), X = range(240).map(i => { const k = i % 3, z = [gauss(r0), gauss(r0)]; const [m, L] = [[[-0.7, 0.3], [[0.35, 0], [0.25, 0.08]]], [[0.6, 0.45], [[0.12, 0], [-0.05, 0.3]]], [[0.3, -0.5], [[0.3, 0], [0.02, 0.1]]]][k]; return [m[0] + L[0][0] * z[0], m[1] + L[1][0] * z[0] + L[1][1] * z[1]]; });
  const c = canvas(box, 600, 380), P = plot(c, -1.6, 1.6, -1.03, 1.03);
  const K = slider(row(box), 'components K', 1, 5, 1, 3);
  let comp, R, it, run = false, ll = NaN, seed = 1;
  const pdf = (x, c) => { const [a, b, d] = [c.S[0][0], c.S[0][1], c.S[1][1]], det = a * d - b * b, u = x[0] - c.m[0], v = x[1] - c.m[1]; return Math.exp(-0.5 * (d * u * u - 2 * b * u * v + a * v * v) / det) / (2 * Math.PI * Math.sqrt(det)); };
  const init = () => { const r = rng(seed++); comp = range(K.v).map(() => ({ pi: 1 / K.v, m: X[Math.floor(r() * X.length)].slice(), S: [[0.08, 0], [0, 0.08]] })); R = X.map(() => comp.map(() => 1 / K.v)); it = 0; ll = NaN; };
  const step = () => {
    ll = 0;
    R = X.map(x => { const w = comp.map(c => c.pi * pdf(x, c)), s = sum(w) || 1e-300; ll += Math.log(s); return w.map(v => v / s); });
    comp = comp.map((c, k) => {
      const Nk = sum(R.map(r => r[k])) + 1e-9, m = [0, 1].map(j => sum(X.map((x, i) => R[i][k] * x[j])) / Nk);
      const S = [[0, 0], [0, 0]]; X.forEach((x, i) => { const u = [x[0] - m[0], x[1] - m[1]]; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) S[a][b] += R[i][k] * u[a] * u[b] / Nk; });
      S[0][0] += 1e-4; S[1][1] += 1e-4; return { pi: Nk / X.length, m, S };
    });
    it++;
  };
  const r2 = row(box); button(r2, 'EM step', step); button(r2, 'Run / pause', () => (run = !run)); button(r2, 'Restart', init);
  const o = out(box);
  let key, acc = 0;
  const draw = () => {
    if (key !== K.v) { key = K.v; init(); }
    P.clear();
    X.forEach((x, i) => { const rgb = [0, 1, 2].map(ch => sum(R[i].map((v, k) => v * hexRGB(PAL[k])[ch]))); P.dot(x[0], x[1], 3.2, `rgb(${rgb.map(Math.round)})`); });
    comp.forEach((cc, k) => { const L = chol(cc.S); [1, 2].forEach(q => P.path(range(61).map(i => { const a = i * Math.PI / 30, u = q * Math.cos(a), v = q * Math.sin(a); return [cc.m[0] + L[0][0] * u, cc.m[1] + L[1][0] * u + L[1][1] * v]; }), PAL[k], q === 1 ? 2.5 : 1, true)); });
    o.innerHTML = `iteration ${it} &nbsp; log-likelihood = <b>${isNaN(ll) ? '(press EM step)' : f2(ll)}</b> &nbsp; mixing weights π = [${comp.map(c => f2(c.pi)).join(', ')}]`;
  };
  loop(box, dt => { if (run && (acc += dt) > 0.3 && it < 200) { acc = 0; step(); draw(); } });
  return draw;
};

V.pca = box => {
  const r0 = rng(41), raw = range(90).map(() => { const z = [gauss(r0), gauss(r0)]; return [1.1 * z[0], 0.75 * z[0] + 0.4 * z[1]]; });
  const mx = sum(raw.map(p => p[0])) / 90, my = sum(raw.map(p => p[1])) / 90, X = raw.map(p => [p[0] - mx, p[1] - my]);
  const S = [[0, 0], [0, 0]]; X.forEach(p => { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) S[a][b] += p[a] * p[b] / 90; });
  const mid = (S[0][0] + S[1][1]) / 2, rad = Math.hypot((S[0][0] - S[1][1]) / 2, S[0][1]), l1 = mid + rad, l2 = mid - rad;
  const pc1 = (() => { const v = [S[0][1], l1 - S[0][0]], n = Math.hypot(...v); return [v[0] / n, v[1] / n]; })();
  const c = canvas(box, 600, 400), P = plot(c, -3.95, 3.95, -2.5, 2.5);
  const h = { x: 0, y: 2.1 };
  drag(P, [h], p => { const n = Math.hypot(p.x, p.y) || 1; p.x *= 2.1 / n; p.y *= 2.1 / n; });
  button(row(box), 'Snap to PC1', () => { h.x = 2.1 * pc1[0]; h.y = 2.1 * pc1[1]; });
  const o = out(box);
  return () => {
    const n = Math.hypot(h.x, h.y), u = [h.x / n, h.y / n];
    let pv = 0, er = 0;
    P.clear(); P.axes(false);
    P.seg(-6 * u[0], -6 * u[1], 6 * u[0], 6 * u[1], C.ink, 1.5);
    X.forEach(p => { const t = p[0] * u[0] + p[1] * u[1], q = [t * u[0], t * u[1]]; pv += t * t / 90; er += ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) / 90; P.seg(p[0], p[1], q[0], q[1], 'rgba(192,57,43,.45)', 1); P.dot(q[0], q[1], 2.5, C.green); });
    X.forEach(p => P.dot(p[0], p[1], 3, C.blue));
    [[pc1, l1], [[-pc1[1], pc1[0]], l2]].forEach(([v, l]) => P.arrow(0, 0, 2 * Math.sqrt(l) * v[0], 2 * Math.sqrt(l) * v[1], C.gray, 1.5));
    P.dot(h.x, h.y, 7, C.ink);
    const tot = pv + er, W = 3.95 * 2 * 0.9, x0 = -3.95 * 0.9;
    P.rect(x0, -2.42, x0 + W * pv / tot, -2.25, C.green); P.rect(x0 + W * pv / tot, -2.42, x0 + W, -2.25, C.red);
    o.innerHTML = `<span style="color:${C.green}">projected variance = <b>${f2(pv)}</b></span> + <span style="color:${C.red}">reconstruction error = ${f2(er)}</span> = total ${f2(tot)} &nbsp; explained ratio = ${pct(pv / tot)} &nbsp; (PC1 keeps ${pct(l1 / (l1 + l2))})`;
  };
};

V.gp = box => {
  const c = canvas(box), P = plot(c, -5, 5, -3, 3);
  let pts = [[-3, -0.5], [-1.5, 0.8], [0.5, 0.3], [2, -1.1]];
  onClick(P, (x, y) => pts.push([x, y]));
  const r = row(box), ell = slider(r, 'ℓ', 0.2, 3, 0.05, 1), sf = slider(r, 'σ_f', 0.3, 2, 0.05, 1), sn = slider(r, 'σ_n', 0.01, 1, 0.01, 0.1);
  const r2 = row(box), smp = check(r2, 'show samples', true); button(r2, 'Clear points', () => (pts = []));
  const zr = rng(8), Z = range(3).map(() => range(60).map(() => gauss(zr)));
  const o = out(box);
  return () => {
    const k = (a, b) => sf.v ** 2 * Math.exp(-((a - b) ** 2) / (2 * ell.v ** 2)), n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const L = chol(xs.map((a, i) => xs.map((b, j) => k(a, b) + (i === j ? sn.v ** 2 : 0)))), al = bwd(L, fwd(L, ys));
    const grid = range(121).map(i => -5 + i / 12), mu = [], sd = [];
    grid.forEach(g => { const ks = xs.map(a => k(a, g)), v = fwd(L, ks); mu.push(sum(ks.map((q, i) => q * al[i]))); sd.push(Math.sqrt(Math.max(1e-12, k(g, g) - sum(v.map(q => q * q))))); });
    P.clear(); P.axes();
    P.path([...grid.map((g, i) => [g, mu[i] + 2 * sd[i]]), ...grid.map((g, i) => [g, mu[i] - 2 * sd[i]]).reverse()], null, 1, true, 'rgba(31,95,191,.15)');
    if (smp.v) {
      const g2 = range(60).map(i => -5 + i * 10 / 59), V2 = g2.map(g => fwd(L, xs.map(a => k(a, g))));
      const Sg = g2.map((a, i) => g2.map((b, j) => k(a, b) - sum(V2[i].map((q, t) => q * V2[j][t])) + (i === j ? 1e-6 : 0))), Ls = chol(Sg);
      const m2 = g2.map(g => sum(xs.map((a, i) => k(a, g) * al[i])));
      Z.forEach((z, s) => P.path(g2.map((g, i) => [g, m2[i] + sum(range(i + 1).map(j => Ls[i][j] * z[j]))]), PAL[s + 2] + 'aa', 1));
    }
    P.path(grid.map((g, i) => [g, mu[i]]), C.blue, 2.5);
    pts.forEach(p => P.dot(p[0], p[1], 5, C.ink));
    const lml = n ? -0.5 * sum(ys.map((y, i) => y * al[i])) - sum(range(n).map(i => Math.log(L[i][i]))) - n / 2 * Math.log(2 * Math.PI) : 0;
    o.innerHTML = `${n} observations &nbsp; log marginal likelihood = <b>${f2(lml)}</b> (try different ℓ: the best value balances fit against complexity)`;
  };
};

/* ---------- Part III, chapter 14 (first half) ---------- */
V.perceptron = box => {
  let w, mist, lr;
  return playground(box, {
    ctl(r) { lr = slider(r, 'η', 0.05, 1, 0.05, 0.2); },
    reset() { w = [0.3, -0.6, 0.1]; mist = null; },
    step(D) { mist = 0; D.X.forEach(([x, y], i) => { const e = D.Y[i] - (w[0] * x + w[1] * y + w[2] > 0 ? 1 : 0); if (e) { mist++; w[0] += lr.v * e * x; w[1] += lr.v * e * y; w[2] += lr.v * e; } }); },
    prob: (x, y) => (w[0] * x + w[1] * y + w[2] > 0 ? [0.15, 0.85] : [0.85, 0.15]),
    extra(P) {
      if (Math.abs(w[1]) > Math.abs(w[0])) P.fn(x => -(w[0] * x + w[2]) / w[1], C.ink, 2);
      else if (w[0]) P.seg(-(w[1] * -1.1 + w[2]) / w[0], -1.1, -(w[1] * 1.1 + w[2]) / w[0], 1.1, C.ink, 2);
    },
    info: () => (mist == null ? 'press Step' : `<b>${mist}</b> mistakes in the last pass, w = (${f2(w[0])}, ${f2(w[1])}), b = ${f2(w[2])}`),
  }, { sets: ['separable blobs', 'xor', 'two blobs'], set: 'separable blobs', spe: 1, dt: 0.35 });
};

V.activations = box => {
  const Pd = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const A = {
    sigmoid: [sigmoid, z => sigmoid(z) * (1 - sigmoid(z))],
    tanh: [Math.tanh, z => 1 - Math.tanh(z) ** 2],
    ReLU: [z => Math.max(0, z), z => +(z > 0)],
    'Leaky ReLU (α = 0.1)': [z => (z > 0 ? z : 0.1 * z), z => (z > 0 ? 1 : 0.1)],
    GELU: [z => z * Phi(z), z => Phi(z) + z * Pd(z)],
    'SiLU (Swish)': [z => z * sigmoid(z), z => sigmoid(z) * (1 + z * (1 - sigmoid(z)))],
  };
  const c = canvas(box), P = plot(c, -5, 5, -1.5, 3);
  const r = row(box), s = select(r, 'activation', Object.keys(A)), z = slider(r, 'z', -5, 5, 0.05, 1);
  const o = out(box);
  return () => {
    const [f, d] = A[s.v];
    P.clear(); P.axes(); P.fn(d, C.red, 2, [6, 4]); P.fn(f, C.blue, 2.5);
    P.dot(z.v, f(z.v), 5, C.blue); P.dot(z.v, d(z.v), 5, C.red);
    o.innerHTML = `φ(${z.v}) = <b>${f2(f(z.v))}</b> &nbsp; φ′(${z.v}) = <b style="color:${C.red}">${f2(d(z.v))}</b>` + (d(z.v) < 0.02 ? ' &nbsp; ← almost no gradient flows back from here' : '');
  };
};

V.mlp = box => {
  let H, NL, act, lr, net, loss, sig, t;
  const f = a => (act.v === 'ReLU' ? Math.max(0, a) : Math.tanh(a)), df = (a, h) => (act.v === 'ReLU' ? +(a > 0) : 1 - h * h);
  const build = D => {
    const r = rng(7), sz = [2, ...Array(NL.v).fill(H.v), D.K];
    net = sz.slice(1).map((n, l) => {
      const m = sz[l], sc = Math.sqrt((act.v === 'ReLU' ? 2 : 1) / m), z = () => range(n).map(() => new Array(m).fill(0));
      return { W: range(n).map(() => range(m).map(() => gauss(r) * sc)), b: new Array(n).fill(0), mW: z(), vW: z(), mb: new Array(n).fill(0), vb: new Array(n).fill(0) };
    });
    sig = H.v + '|' + NL.v + act.v; t = 0; loss = null;
  };
  const fw = x => { const A = [], Hs = [x]; net.forEach((L, l) => { const a = L.W.map((w, j) => { let s = L.b[j]; for (let i = 0; i < w.length; i++) s += w[i] * Hs[l][i]; return s; }); A.push(a); Hs.push(l < net.length - 1 ? a.map(f) : soft(a)); }); return [A, Hs]; };
  return playground(box, {
    ctl(r) { H = slider(r, 'hidden units', 1, 32, 1, 8); NL = slider(r, 'hidden layers', 1, 3, 1, 1); act = select(r, 'activation', ['tanh', 'ReLU']); lr = slider(r, 'learning rate', 0.001, 0.1, 0.001, 0.03); },
    reset: build,
    step(D) {
      if (sig !== H.v + '|' + NL.v + act.v) build(D);
      const G = net.map(L => ({ W: L.W.map(w => w.map(() => 0)), b: L.b.map(() => 0) }));
      let l2 = 0;
      D.X.forEach((x, n) => {
        const [A, Hs] = fw(x), out = Hs[Hs.length - 1]; l2 -= Math.log(out[D.Y[n]] + 1e-12);
        let d = out.map((p, k) => p - (D.Y[n] === k));
        for (let l = net.length - 1; l >= 0; l--) {
          const L = net[l];
          d.forEach((dj, j) => { G[l].b[j] += dj; for (let i = 0; i < Hs[l].length; i++) G[l].W[j][i] += dj * Hs[l][i]; });
          if (l) d = Hs[l].map((h, i) => { let s = 0; d.forEach((dj, j) => (s += L.W[j][i] * dj)); return s * df(A[l - 1][i], h); });
        }
      });
      t++; const N = D.X.length, b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
      const upd = (p, g, m, v, i) => { const q = g[i] / N; m[i] = b1 * m[i] + (1 - b1) * q; v[i] = b2 * v[i] + (1 - b2) * q * q; p[i] -= lr.v * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); };
      net.forEach((L, l) => { L.W.forEach((w, j) => w.forEach((_, i) => upd(w, G[l].W[j], L.mW[j], L.vW[j], i))); L.b.forEach((_, j) => upd(L.b, G[l].b, L.mb, L.vb, j)); });
      loss = l2 / N;
    },
    prob: (x, y) => { const Hs = fw([x, y])[1]; return Hs[Hs.length - 1]; },
    info: () => `${sum(net.map(L => L.W.length * (L.W[0].length + 1)))} parameters &nbsp; ` + (loss == null ? 'press Train' : `cross-entropy = ${f2(loss)}`),
  }, { sets: ['spiral', 'circles', 'xor', 'moons', 'three blobs'], set: 'circles', spe: 3 });
};

V.losses = box => {
  const c = canvas(box), P = plot(c, -3, 3, -0.5, 4.5);
  const r = row(box), mode = select(r, 'losses', ['regression (vs error e)', 'classification (vs score z, y = 1)']), dlt = slider(r, 'Huber δ', 0.2, 2, 0.1, 1), der = check(r, 'derivative', false);
  const o = out(box);
  return () => {
    const reg = mode.v[0] === 'r';
    const L = reg
      ? [['MSE e²', e => e * e, e => 2 * e], ['MAE |e|', Math.abs, e => Math.sign(e)], [`Huber (δ = ${dlt.v})`, e => (Math.abs(e) <= dlt.v ? e * e / 2 : dlt.v * (Math.abs(e) - dlt.v / 2)), e => Math.max(-dlt.v, Math.min(dlt.v, e))]]
      : [['log loss  log(1 + e^(−z))', z => Math.log1p(Math.exp(-z)), z => -sigmoid(-z)], ['hinge  max(0, 1 − z)', z => Math.max(0, 1 - z), z => (z < 1 ? -1 : 0)], ['0–1 loss', z => +(z <= 0), () => 0], ['MSE on sigmoid  (1 − σ(z))²', z => (1 - sigmoid(z)) ** 2, z => -2 * (1 - sigmoid(z)) * sigmoid(z) * (1 - sigmoid(z))]];
    Object.assign(P, reg ? { x0: -3, x1: 3, y0: der.v ? -3 : -0.3, y1: der.v ? 3 : 4.5 } : { x0: -4, x1: 4, y0: der.v ? -1.3 : -0.2, y1: der.v ? 0.6 : 4.5 });
    P.clear(); P.axes();
    L.forEach(([, f, d], i) => P.fn(der.v ? d : f, PAL[i], 2.5));
    o.innerHTML = L.map(([n], i) => `<span style="color:${PAL[i]}">■ ${n}</span>`).join(' &nbsp; ') + (der.v ? ' &nbsp; (showing derivatives)' : '');
  };
};

V.backprop = box => {
  const c = canvas(box, 600, 330), { ctx } = c;
  const r = row(box), x1 = slider(r, 'x₁', -2, 2, 0.1, 1), x2 = slider(r, 'x₂', -2, 2, 0.1, -0.5), y = slider(r, 'target y', -1, 2, 0.1, 1);
  const r2 = row(box), eta = slider(r2, 'η', 0.1, 2, 0.1, 0.5);
  const init = () => ({ W1: [[0.5, -0.4], [0.3, 0.8]], b1: [0.1, -0.1], w2: [0.7, -0.5], b2: 0.2 });
  let p = init(), steps = 0;
  const F = (q, x) => { const a = q.W1.map((w, j) => w[0] * x[0] + w[1] * x[1] + q.b1[j]), h = a.map(sigmoid), yh = q.w2[0] * h[0] + q.w2[1] * h[1] + q.b2; return { a, h, yh, L: 0.5 * (yh - y.v) ** 2 }; };
  const grads = (q, x) => {
    const { h, yh } = F(q, x), dO = yh - y.v, dH = h.map((hj, j) => q.w2[j] * dO * hj * (1 - hj));
    return { dO, dH, W1: dH.map(d => [d * x[0], d * x[1]]), b1: dH, w2: h.map(hj => dO * hj), b2: dO };
  };
  button(r2, 'Gradient step', () => { const x = [x1.v, x2.v], g = grads(p, x); p.W1 = p.W1.map((w, j) => w.map((v, i) => v - eta.v * g.W1[j][i])); p.b1 = p.b1.map((v, j) => v - eta.v * g.b1[j]); p.w2 = p.w2.map((v, j) => v - eta.v * g.w2[j]); p.b2 -= eta.v * g.b2; steps++; });
  button(r2, 'Reset weights', () => { p = init(); steps = 0; });
  const o = out(box);
  const node = (x, yy, t1, t2, t3, col) => {
    ctx.fillStyle = '#fff'; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, yy, 34, 0, 7); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.font = '13px Times New Roman'; ctx.fillText(t1, x, yy - 8); ctx.font = FONT; ctx.fillText(t2, x, yy + 9);
    if (t3) { ctx.fillStyle = C.red; ctx.font = '13px Times New Roman'; ctx.fillText(t3, x, yy + 52); }
  };
  const edge = (xa, ya, xb, yb, w, g, k) => {
    ctx.strokeStyle = w >= 0 ? 'rgba(31,95,191,.6)' : 'rgba(192,57,43,.6)'; ctx.lineWidth = 1 + Math.min(4, 2 * Math.abs(w));
    ctx.beginPath(); ctx.moveTo(xa + 34, ya); ctx.lineTo(xb - 34, yb); ctx.stroke();
    const t = k, mx = xa + 34 + (xb - xa - 68) * t, my = ya + (yb - ya) * t;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(mx - 34, my - 17, 68, 32);
    ctx.font = '13px Times New Roman'; ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.fillText(`w = ${f2(w)}`, mx, my - 3); ctx.fillStyle = C.red; ctx.fillText(`∂ = ${f2(g)}`, mx, my + 12); ctx.font = FONT;
  };
  return () => {
    const x = [x1.v, x2.v], f = F(p, x), g = grads(p, x);
    let worst = 0; const e = 1e-5, L0 = q => F(q, x).L;
    const chk = (get, set, an) => { const v = get(); set(v + e); const a = L0(p); set(v - e); const b = L0(p); set(v); worst = Math.max(worst, Math.abs((a - b) / (2 * e) - an)); };
    [0, 1].forEach(j => { [0, 1].forEach(i => chk(() => p.W1[j][i], v => (p.W1[j][i] = v), g.W1[j][i])); chk(() => p.b1[j], v => (p.b1[j] = v), g.b1[j]); chk(() => p.w2[j], v => (p.w2[j] = v), g.w2[j]); });
    chk(() => p.b2, v => (p.b2 = v), g.b2);
    ctx.clearRect(0, 0, 600, 330);
    const IN = [[70, 90], [70, 240]], HID = [[300, 90], [300, 240]], OUT = [530, 165];
    IN.forEach(([a, b], i) => HID.forEach(([c2, d], j) => edge(a, b, c2, d, p.W1[j][i], g.W1[j][i], i === j ? 0.5 : i ? 0.75 : 0.25)));
    HID.forEach(([a, b], j) => edge(a, b, OUT[0], OUT[1], p.w2[j], g.w2[j], 0.5));
    IN.forEach(([a, b], i) => node(a, b, `x${'₁₂'[i]}`, f2(x[i]), '', C.gray));
    HID.forEach(([a, b], j) => node(a, b, `h${'₁₂'[j]} = σ(a)`, f2(f.h[j]), `δ = ${f2(g.dH[j])}, b = ${f2(p.b1[j])}`, C.blue));
    node(OUT[0], OUT[1], 'ŷ', f2(f.yh), `δ = ŷ − y = ${f2(g.dO)}`, C.purple);
    o.innerHTML = `loss L = ½(ŷ − y)² = <b>${f2(f.L)}</b> after ${steps} steps &nbsp; gradient check: max |backprop − finite difference| = ${worst.toExponential(1)}`;
  };
};

/* ---------- Part III, chapter 14 (second half) ---------- */
V.init = box => {
  const c = canvas(box, 600, 230), { ctx } = c;
  const r = row(box), act = select(r, 'activation', ['tanh', 'ReLU']), g = slider(r, 'gain g', 0.1, 3, 0.05, 0.5);
  const r2 = row(box); button(r2, 'Xavier (g = 1)', () => (g.v = 1)); button(r2, 'He (g = √2)', () => (g.v = 1.41));
  const r0 = rng(5), X0 = range(100).map(() => range(64).map(() => gauss(r0))), Wz = range(10).map(() => range(64).map(() => range(64).map(() => gauss(r0))));
  const o = out(box);
  return () => {
    const s = g.v / 8, relu = act.v === 'ReLU', lo = relu ? 0 : -1, hi = relu ? 3 : 1, sds = [];
    let H = X0;
    ctx.clearRect(0, 0, 600, 230); ctx.font = '12px Times New Roman'; ctx.textAlign = 'center';
    for (let l = 0; l < 10; l++) {
      H = H.map(h => Wz[l].map(w => { let a = 0; for (let i = 0; i < 64; i++) a += w[i] * h[i]; a *= s; return relu ? Math.max(0, a) : Math.tanh(a); }));
      const vals = H.flat(), sd = Math.sqrt(sum(vals.map(v => v * v)) / vals.length), bins = new Array(20).fill(0);
      vals.forEach(v => bins[Math.max(0, Math.min(19, Math.floor((v - lo) / (hi - lo) * 20)))]++);
      const mx = Math.max(...bins), x0 = 6 + l * 59;
      ctx.strokeStyle = '#ddd'; ctx.strokeRect(x0, 25, 55, 150);
      bins.forEach((b, i) => { const hh = 145 * b / mx; ctx.fillStyle = C.blue; ctx.fillRect(x0 + 1 + i * 2.65, 174 - hh, 2.3, hh); });
      ctx.fillStyle = C.ink; ctx.fillText(`layer ${l + 1}`, x0 + 27, 18);
      ctx.fillStyle = sd < 0.05 || sd > 5 ? C.red : C.ink; ctx.fillText(`σ = ${sd < 1e-3 || sd > 1e3 ? sd.toExponential(0) : sd.toFixed(2)}`, x0 + 27, 192);
      sds.push(sd);
    }
    ctx.fillStyle = C.gray; ctx.fillText(`each panel: histogram over [${lo}, ${hi}]`, 300, 220); ctx.font = FONT;
    o.innerHTML = `Var(w) = g²/n<sub>in</sub> = ${f2(g.v ** 2)}/64 &nbsp; activation spread goes from ${f2(sds[0])} (layer 1) to <b>${f2(sds[9])}</b> (layer 10)`;
  };
};

V.optimizers = box => {
  const F = {
    'narrow valley': { f: (x, y) => 0.05 * x * x + 2 * y * y, g: (x, y) => [0.1 * x, 4 * y], r: [-4.5, 4.5, -2.8, 2.8], s: [-4, 1.6], lo: 0, hi: 18, lr: [-0.7, -1] },
    Rosenbrock: { f: (x, y) => Math.log1p((1 - x) ** 2 + 100 * (y - x * x) ** 2), raw: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2, g: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)], r: [-2, 2, -1, 3], s: [-1.5, 2.2], lo: 0, hi: 8, lr: [-3.2, -1.3] },
  };
  const c = canvas(box, 600, 380), P = plot(c, -4.5, 4.5, -2.8, 2.8);
  const r = row(box), fs = select(r, 'surface', Object.keys(F));
  const r2 = row(box), lr1 = slider(r2, 'η for SGD and momentum', -4, 0, 0.1, -0.7, v => (10 ** v).toPrecision(2)), lr2 = slider(r2, 'η for RMSProp and Adam', -3, 0, 0.1, -1, v => (10 ** v).toPrecision(2));
  let st = null, run = false, key, bg, start;
  const names = ['SGD', 'Momentum', 'RMSProp', 'Adam'];
  const reset = () => { st = names.map(() => ({ p: start.slice(), v: [0, 0], s: [0, 0], m: [0, 0], t: 0, path: [start.slice()] })); };
  const step = () => {
    const G = F[fs.v].g, a = 10 ** lr1.v, b = 10 ** lr2.v;
    st.forEach((o, k) => {
      if (o.path.length > 600 || !isFinite(o.p[0]) || Math.abs(o.p[0]) > 1e3) return;
      const g = G(...o.p).map(q => Math.max(-1e4, Math.min(1e4, q)));
      o.t++;
      if (k === 0) o.p = o.p.map((q, i) => q - a * g[i]);
      if (k === 1) { o.v = o.v.map((q, i) => 0.9 * q + g[i]); o.p = o.p.map((q, i) => q - a * o.v[i]); }
      if (k === 2) { o.s = o.s.map((q, i) => 0.9 * q + 0.1 * g[i] ** 2); o.p = o.p.map((q, i) => q - b * g[i] / (Math.sqrt(o.s[i]) + 1e-8)); }
      if (k === 3) { o.m = o.m.map((q, i) => 0.9 * q + 0.1 * g[i]); o.s = o.s.map((q, i) => 0.999 * q + 0.001 * g[i] ** 2); o.p = o.p.map((q, i) => q - b * (o.m[i] / (1 - 0.9 ** o.t)) / (Math.sqrt(o.s[i] / (1 - 0.999 ** o.t)) + 1e-8)); }
      o.path.push(o.p.slice());
    });
  };
  onClick(P, (x, y) => { start = [x, y]; reset(); });
  const r3 = row(box); button(r3, 'Run / pause', () => (run = !run)); button(r3, 'Step', step); button(r3, 'Reset', () => reset());
  const o = out(box);
  const draw = () => {
    const S = F[fs.v];
    if (key !== fs.v) { key = fs.v; [P.x0, P.x1, P.y0, P.y1] = S.r; bg = field(P, S.f, S.lo, S.hi, 18); start = S.s.slice(); lr1.v = S.lr[0]; lr2.v = S.lr[1]; reset(); run = false; }
    P.clear(); bg();
    if (fs.v === 'Rosenbrock') P.dot(1, 1, 5, C.ink, true); else P.dot(0, 0, 5, C.ink, true);
    st.forEach((q, k) => { P.path(q.path.map(([x, y]) => [Math.max(-50, Math.min(50, x)), Math.max(-50, Math.min(50, y))]), PAL[k], 2); P.dot(q.p[0], q.p[1], 4.5, PAL[k]); });
    P.dot(start[0], start[1], 5, C.ink);
    const val = (x, y) => (S.raw || S.f)(x, y);
    o.innerHTML = names.map((n, k) => `<span style="color:${PAL[k]}">■ ${n}: f = ${isFinite(st[k].p[0]) && Math.abs(st[k].p[0]) < 1e3 ? f2(val(...st[k].p)) : 'diverged'}</span>`).join(' &nbsp; ') + ` &nbsp; step ${st[0].path.length - 1}`;
  };
  loop(box, () => { if (run) { step(); step(); draw(); } });
  return draw;
};

V.dropout = box => {
  const c = canvas(box, 600, 260), { ctx } = c;
  const r = row(box), p = slider(r, 'drop rate p', 0, 0.9, 0.05, 0.5), anim = check(r, 'animate', true);
  button(r, 'New mask', () => sample()); button(r, 'Reset average', () => (hist = []));
  const L = [4, 6, 6, 2], X = [40, 135, 230, 325], pos = L.map((n, l) => range(n).map(i => [X[l], 130 + (i - (n - 1) / 2) * 38]));
  let mask = L.map(n => new Array(n).fill(1)), hist = [], rnd = rng(13);
  const sample = () => {
    mask = L.map((n, l) => range(n).map(() => (l === 1 || l === 2 ? +(rnd() >= p.v) : 1)));
    hist.push(+(rnd() >= p.v) / (1 - p.v)); if (hist.length > 120) hist.shift();
  };
  const o = out(box);
  let acc = 0;
  const draw = () => {
    ctx.clearRect(0, 0, 600, 260);
    for (let l = 0; l < 3; l++) pos[l].forEach((a, i) => pos[l + 1].forEach((b, j) => {
      const on = mask[l][i] && mask[l + 1][j]; ctx.strokeStyle = on ? 'rgba(31,95,191,.5)' : 'rgba(0,0,0,.05)'; ctx.lineWidth = on ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }));
    pos.forEach((ly, l) => ly.forEach(([x, y], i) => {
      const on = mask[l][i]; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fillStyle = on ? (l === 1 || l === 2 ? C.blue : C.ink) : '#ddd'; ctx.fill();
      if (!on) { ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
    }));
    const top = Math.min(5, 1 / (1 - p.v)) * 1.15, Y = v => 230 - v / top * 200, Xh = i => 400 + i * 190 / 120;
    ctx.strokeStyle = '#ccc'; ctx.strokeRect(400, 30, 190, 200);
    ctx.strokeStyle = C.red; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(400, Y(1)); ctx.lineTo(590, Y(1)); ctx.stroke(); ctx.setLineDash([]);
    let s = 0; ctx.strokeStyle = C.purple; ctx.lineWidth = 2; ctx.beginPath();
    hist.forEach((v, i) => { ctx.fillStyle = C.gray; ctx.fillRect(Xh(i) - 1, Y(v) - 1, 2.5, 2.5); s += v; i ? ctx.lineTo(Xh(i), Y(s / (i + 1))) : ctx.moveTo(Xh(i), Y(s / (i + 1))); });
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = C.gray; ctx.font = '12px Times New Roman'; ctx.textAlign = 'left'; ctx.fillText('tracked unit: samples, mean', 400, 22); ctx.font = FONT;
    const on = sum(mask[1]) + sum(mask[2]);
    o.innerHTML = `${on} of 12 hidden units active this pass; survivors scaled by 1/(1 − p) = ${f2(1 / (1 - p.v))} &nbsp; running mean of the tracked unit = <b>${hist.length ? f2(sum(hist) / hist.length) : '—'}</b> (target 1)`;
  };
  loop(box, dt => { if (anim.v && (acc += dt) > 0.5) { acc = 0; sample(); draw(); } });
  return draw;
};

V.batchnorm = box => {
  const c = canvas(box, 600, 330), { ctx } = c, r0 = rng(19), Z = range(256).map(() => gauss(r0));
  const r = row(box), mi = slider(r, 'input mean', -6, 6, 0.1, 3.5), si = slider(r, 'input std', 0.2, 4, 0.1, 2.2), B = slider(r, 'batch size B', 4, 256, 1, 64);
  const r2 = row(box), ga = slider(r2, 'γ', 0.2, 3, 0.05, 1), be = slider(r2, 'β', -4, 4, 0.1, 0);
  const o = out(box);
  const X = v => 30 + (v + 10) / 20 * 540;
  const hist = (vals, top, col, label) => {
    const bins = new Array(80).fill(0); vals.forEach(v => { const k = Math.floor((v + 10) / 20 * 80); if (k >= 0 && k < 80) bins[k]++; });
    const mx = Math.max(...bins, 1);
    ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(30, top + 90); ctx.lineTo(570, top + 90); ctx.stroke();
    bins.forEach((b, i) => { const h = 80 * b / mx; ctx.fillStyle = col; ctx.fillRect(30 + i * 6.75, top + 90 - h, 5.8, h); });
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(label, 34, top + 12);
  };
  return () => {
    const x = Z.slice(0, B.v).map(z => mi.v + si.v * z), mu = sum(x) / x.length, sd = Math.sqrt(sum(x.map(v => (v - mu) ** 2)) / x.length + 1e-5);
    const xh = x.map(v => (v - mu) / sd), y = xh.map(v => ga.v * v + be.v);
    ctx.clearRect(0, 0, 600, 330);
    hist(x, 5, '#999', 'raw batch x'); hist(xh, 112, C.blue, 'x̂ = (x − μ_B)/σ_B'); hist(y, 219, C.red, 'y = γx̂ + β');
    ctx.fillStyle = C.gray; ctx.font = '12px Times New Roman'; ctx.textAlign = 'center';
    [-10, -5, 0, 5, 10].forEach(v => ctx.fillText(v, X(v), 326)); ctx.font = FONT;
    o.innerHTML = `μ<sub>B</sub> = ${f2(mu)} (true ${mi.v}), σ<sub>B</sub> = ${f2(sd)} (true ${si.v}) &nbsp; x̂: mean 0, std 1 &nbsp; y: mean ${f2(be.v)}, std ${f2(ga.v)}`;
  };
};

V.residual = box => {
  const c = canvas(box), P = plot(c, 0, 50, -8, 8);
  const r = row(box), Ls = slider(r, 'depth L', 2, 100, 1, 50), g = slider(r, 'plain gain g', 0.5, 1.5, 0.01, 0.85), al = slider(r, 'branch scale α', 0.05, 1, 0.05, 0.2);
  const r0 = rng(29), U = range(100).map(() => 1 + 0.3 * (2 * r0() - 1));
  const o = out(box);
  return () => {
    const L = Ls.v; P.x1 = L;
    const plain = [], res = []; let a = 0, b = 0;
    for (let l = L; l >= 1; l--) { plain.unshift([l, a]); res.unshift([l, b]); const d = g.v * U[l - 1]; a += Math.log10(d); b += 0.5 * Math.log10(1 + (al.v * d) ** 2); }
    P.clear(); P.axes();
    P.path(plain.map(([l, v]) => [l, Math.max(-8, Math.min(8, v))]), C.red, 2.5); P.path(res, C.blue, 2.5);
    P.text('log₁₀ |gradient| at layer l (loss at layer L)', 1, 7.3, C.gray);
    o.innerHTML = `gradient reaching layer 1: <span style="color:${C.red}">plain = 10^${f2(plain[0][1])}</span> &nbsp; <span style="color:${C.blue}">residual = 10^${f2(res[0][1])}</span>`;
  };
};

/* ---------- Part III, chapter 15 and chapter 16 (first half) ---------- */
V.rnn = box => {
  const c1 = canvas(box, 600, 170), P1 = plot(c1, 1, 50, -1.1, 1.1), c2 = canvas(box, 600, 190), P2 = plot(c2, 1, 50, -12, 2);
  const r = row(box), w = slider(r, 'recurrent weight w', 0.1, 3, 0.05, 0.9), nz = slider(r, 'input noise', 0, 0.5, 0.01, 0.1);
  const r0 = rng(37), N = range(50).map(() => gauss(r0));
  const o = out(box);
  return () => {
    const h = [], a = []; let prev = 0;
    for (let t = 0; t < 50; t++) { const at = w.v * prev + (t === 0 ? 1 : nz.v * N[t]); a.push(at); prev = Math.tanh(at); h.push(prev); }
    const g = new Array(50).fill(0); let lg = 0;
    for (let i = 48; i >= 0; i--) { lg += Math.log10(Math.abs(w.v * (1 - Math.tanh(a[i + 1]) ** 2)) + 1e-300); g[i] = lg; }
    P1.clear(); P1.axes(); P1.path(h.map((v, i) => [i + 1, v]), C.blue, 2); P1.text('hidden state hₜ', 2, 0.95, C.gray);
    P2.clear(); P2.axes(); P2.path(g.map((v, i) => [i + 1, Math.max(-12, v)]), C.red, 2); P2.text('log₁₀ |∂h₅₀ / ∂hₜ|', 2, 1.4, C.gray);
    o.innerHTML = `per-step factor |w · tanh′(a)| ≈ ${f2(Math.abs(w.v * (1 - Math.tanh(a[25]) ** 2)))} &nbsp; gradient from step 50 back to step 1 = <b>10^${f2(g[0])}</b>`;
  };
};

V.lstm = box => {
  const c = canvas(box), P = plot(c, 1, 60, -1.3, 1.5);
  const r = row(box), f = slider(r, 'forget gate f', 0.5, 1, 0.005, 0.98), ig = slider(r, 'input gate after step 1', 0, 0.5, 0.01, 0.02);
  const r2 = row(box), nz = slider(r2, 'noise', 0, 1, 0.05, 0.5), w = slider(r2, 'RNN weight w', 0.5, 1.5, 0.05, 1);
  const r0 = rng(43), N = range(60).map(() => gauss(r0));
  const o = out(box);
  return () => {
    const cs = [1], hs = [Math.tanh(1)];
    for (let t = 1; t < 60; t++) { const x = nz.v * N[t]; cs.push(f.v * cs[t - 1] + ig.v * Math.tanh(x)); hs.push(Math.tanh(w.v * hs[t - 1] + x)); }
    P.clear(); P.axes(); P.seg(1, 1, 60, 1, C.gray, 1, [5, 4]);
    P.path(cs.map((v, i) => [i + 1, v]), C.blue, 2.5); P.path(hs.map((v, i) => [i + 1, v]), C.red, 2);
    o.innerHTML = `value at step 60: <span style="color:${C.blue}">LSTM cell = <b>${f2(cs[59])}</b></span>, <span style="color:${C.red}">RNN state = <b>${f2(hs[59])}</b></span> &nbsp; gradient along the cell path ∂c₆₀/∂c₁ = f⁵⁹ = ${f2(f.v ** 59)}`;
  };
};

V.bpe = box => {
  const corpus = { low: 5, lower: 2, lowest: 2, newest: 6, newer: 3, new: 2, widest: 3, wider: 2 };
  const c = canvas(box, 600, 300), { ctx } = c;
  let words, merges;
  const reset = () => { words = Object.entries(corpus).map(([w, n]) => ({ t: [...w, '_'], n })); merges = []; };
  const pairs = () => { const m = new Map(); words.forEach(({ t, n }) => { for (let i = 0; i < t.length - 1; i++) { const k = t[i] + '|' + t[i + 1]; m.set(k, (m.get(k) || 0) + n); } }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const merge = () => {
    const p = pairs(); if (!p.length) return; const [a, b] = p[0][0].split('|'); merges.push(a + b);
    words.forEach(w => { const t = []; for (let i = 0; i < w.t.length; i++) { if (i < w.t.length - 1 && w.t[i] === a && w.t[i + 1] === b) { t.push(a + b); i++; } else t.push(w.t[i]); } w.t = t; });
  };
  reset();
  const r = row(box); button(r, 'Merge', merge); button(r, 'Merge 5', () => range(5).forEach(merge)); button(r, 'Reset', reset);
  const o = out(box);
  return () => {
    ctx.clearRect(0, 0, 600, 300); ctx.font = '15px Times New Roman';
    const top = pairs()[0], hl = top ? top[0].split('|') : [];
    words.forEach(({ t, n }, i) => {
      const y = 14 + i * 34; let x = 50;
      ctx.fillStyle = C.gray; ctx.textAlign = 'right'; ctx.fillText(`${n} ×`, 40, y + 18); ctx.textAlign = 'center';
      t.forEach((tok, j) => {
        const wd = ctx.measureText(tok).width + 14, isHl = top && tok === hl[0] && t[j + 1] === hl[1], isHl2 = top && j > 0 && t[j - 1] === hl[0] && tok === hl[1];
        ctx.fillStyle = isHl || isHl2 ? 'rgba(212,128,15,.3)' : tok.length > 1 ? 'rgba(31,95,191,.15)' : '#f4f4f4';
        ctx.fillRect(x, y, wd, 26); ctx.strokeStyle = '#bbb'; ctx.strokeRect(x, y, wd, 26);
        ctx.fillStyle = C.ink; ctx.fillText(tok, x + wd / 2, y + 18); x += wd + 4;
      });
    });
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText('most frequent pairs', 400, 22);
    pairs().slice(0, 7).forEach(([k, v], i) => { ctx.fillStyle = i ? C.ink : C.orange; ctx.fillText(`${k.replace('|', ' + ')}   ${v}`, 400, 48 + i * 24); });
    ctx.font = FONT;
    const nTok = sum(words.map(w => w.t.length * w.n));
    o.innerHTML = `merges so far: ${merges.length ? merges.map(m => `<b>${m}</b>`).join(', ') : 'none'} &nbsp; vocabulary = ${new Set([...Object.keys(corpus).join('') + '_']).size + merges.length} tokens &nbsp; corpus length = ${nTok} tokens ('_' marks the end of a word)`;
  };
};

V.attention = box => {
  const toks = ['the', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'];
  const K = [[0.2, 0, 0, 0], [1, 1, 0, 0], [0, 0.3, 0, 1], [0, 0, 0.6, 0.2], [0.2, 0, 0, 0], [1, 0, 1, 0], [0, 0, 0, 0.4], [0.5, 0.5, 0, 0], [0, 0, 0, 0.8], [0, 0.8, 0, 0.5]];
  const Q = [[1, 0, 0, 0], [0, 0, 0, 1], [0.3, 1, 0.6, 0], [0.5, 0, 1, 0], [1, 0, 0, 0], [0, 0, 0.5, 0.3], [0, 0, 0, 1], [1, 1.2, -0.5, 0], [0.5, 0.8, 0, 0], [0.5, 1, 0, 0]];
  const c = canvas(box, 600, 360), { ctx } = c;
  const r = row(box), sc = slider(r, 'score scale', 0.2, 8, 0.1, 2.5), causal = check(r, 'causal mask', false);
  let qi = 7;
  const X = i => 32 + i * 59;
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 360 / b.height; if (y < 70) { qi = Math.max(0, Math.min(9, Math.round((x - 32) / 59))); closestBox(c.cv).draw(); } });
  const o = out(box);
  return () => {
    const Wt = Q.map((q, i) => soft(K.map((k, j) => (causal.v && j > i ? -1e9 : sc.v * sum(q.map((v, m) => v * k[m]))))));
    ctx.clearRect(0, 0, 600, 360); ctx.font = '15px Times New Roman'; ctx.textAlign = 'center';
    toks.forEach((t, i) => { ctx.fillStyle = i === qi ? 'rgba(212,128,15,.35)' : '#f4f4f4'; ctx.fillRect(X(i) - 28, 14, 56, 28); ctx.fillStyle = C.ink; ctx.fillText(t, X(i), 33); });
    Wt[qi].forEach((w, j) => {
      if (w < 0.005) return;
      ctx.strokeStyle = `rgba(31,95,191,${0.15 + 0.85 * w})`; ctx.lineWidth = 1 + 14 * w;
      ctx.beginPath(); ctx.moveTo(X(qi), 44); ctx.quadraticCurveTo((X(qi) + X(j)) / 2, 60 + 9 * Math.abs(qi - j) + 10, X(j), 44); ctx.stroke();
      ctx.fillStyle = C.blue; ctx.font = '12px Times New Roman'; ctx.fillText(f2(w), X(j), 58); ctx.font = '15px Times New Roman';
    });
    const cs = 17, hx = 300 - 5 * cs + 20, hy = 160;
    ctx.font = '11px Times New Roman';
    toks.forEach((t, i) => { ctx.textAlign = 'right'; ctx.fillStyle = i === qi ? C.orange : C.gray; ctx.fillText(t, hx - 4, hy + i * cs + 12); ctx.save(); ctx.translate(hx + i * cs + 12, hy - 4); ctx.rotate(-Math.PI / 3); ctx.textAlign = 'left'; ctx.fillStyle = C.gray; ctx.fillText(t, 0, 0); ctx.restore(); });
    Wt.forEach((rw, i) => rw.forEach((w, j) => { ctx.fillStyle = `rgba(31,95,191,${w})`; ctx.fillRect(hx + j * cs, hy + i * cs, cs - 1, cs - 1); }));
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.strokeRect(hx - 1, hy + qi * cs - 1, 10 * cs + 1, cs + 1);
    ctx.font = FONT;
    const top = Wt[qi].map((w, j) => [w, j]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    o.innerHTML = `query "<b>${toks[qi]}</b>" attends to: ` + top.map(([w, j]) => `${toks[j]} (${f2(w)})`).join(', ') + ' &nbsp; rows of the heatmap: queries; columns: keys';
  };
};

V.posenc = box => {
  const c1 = canvas(box, 600, 210), { ctx } = c1, c2 = canvas(box, 600, 180), P = plot(c2, 0, 63, -0.4, 1.05);
  const r = row(box), d = select(r, 'd', ['16', '32', '64', '128'], '64'), p0 = slider(r, 'p₀', 0, 63, 1, 20);
  const o = out(box);
  return () => {
    const D = +d.v, pe = p => range(D).map(k => { const i = Math.floor(k / 2), a = p / Math.pow(10000, 2 * i / D); return k % 2 ? Math.cos(a) : Math.sin(a); });
    const E = range(64).map(pe), cw = 540 / D, ch = 190 / 64;
    ctx.clearRect(0, 0, 600, 210);
    E.forEach((rw, p) => rw.forEach((v, k) => { ctx.fillStyle = v > 0 ? `rgba(192,57,43,${v})` : `rgba(31,95,191,${-v})`; ctx.fillRect(40 + k * cw, 10 + p * ch, cw + 0.5, ch + 0.5); }));
    ctx.strokeStyle = C.ink; ctx.strokeRect(40, 10 + p0.v * ch, 540, ch);
    ctx.fillStyle = C.gray; ctx.font = '12px Times New Roman'; ctx.textAlign = 'right'; ctx.fillText('p = 0', 36, 20); ctx.fillText('63', 36, 200); ctx.textAlign = 'left'; ctx.fillText(`rows: position p;  columns: dimension 0 … ${D - 1}`, 44, 208); ctx.font = FONT;
    const s = E.map(e => sum(e.map((v, k) => v * E[p0.v][k])) / (D / 2));
    P.clear(); P.axes(); P.path(s.map((v, p) => [p, v]), C.purple, 2); P.dot(p0.v, 1, 5, C.ink);
    o.innerHTML = `similarity PE(p₀)·PE(p) / (d/2): equals 1 at p = p₀ = ${p0.v} and depends only on the offset |p − p₀|`;
  };
};

/* ---------- Part III, chapter 16 (second half) ---------- */
// Top-k singular triplets by power iteration with deflation (fine for small matrices).
function svdTop(A, k, seed = 1) {
  const m = A.length, n = A[0].length, R = A.map(r => r.slice()), rnd = rng(seed), res = [];
  for (let q = 0; q < k; q++) {
    let v = range(n).map(() => rnd() - 0.5), u, s = 0;
    for (let it = 0; it < 60; it++) {
      u = range(m).map(i => { let t = 0; for (let j = 0; j < n; j++) t += R[i][j] * v[j]; return t; });
      const nu = Math.hypot(...u) || 1; u = u.map(x => x / nu);
      v = range(n).map(j => { let t = 0; for (let i = 0; i < m; i++) t += R[i][j] * u[i]; return t; });
      s = Math.hypot(...v) || 1; v = v.map(x => x / s);
    }
    res.push({ s, u, v });
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) R[i][j] -= s * u[i] * v[j];
  }
  return res;
}
const big = (x, unit = '') => (x >= 1e12 ? f2(x / 1e12) + ' T' : x >= 1e9 ? f2(x / 1e9) + ' G' : x >= 1e6 ? f2(x / 1e6) + ' M' : x >= 1e3 ? f2(x / 1e3) + ' k' : f2(x) + ' ') + unit;

V.transformer = box => {
  const DS = [128, 256, 384, 512, 768, 1024, 1280, 1600, 2048, 2560, 4096, 5120, 6144, 8192, 12288, 16384], NS = [512, 1024, 2048, 4096, 8192, 32768, 131072];
  const c = canvas(box, 600, 250), { ctx } = c;
  const r = row(box), d = slider(r, 'width d', 0, 15, 1, 4, i => DS[i]), L = slider(r, 'layers L', 1, 128, 1, 12);
  const r2 = row(box), Vs = select(r2, 'vocabulary V', ['32000', '50257', '128256'], '50257'), n = slider(r2, 'context n', 0, 6, 1, 1, i => NS[i].toLocaleString());
  const presets = { 'GPT-2 small': [4, 12, '50257', 1], 'GPT-2 XL': [7, 48, '50257', 1], 'LLaMA-2 7B': [10, 32, '32000', 3], 'GPT-3 175B': [14, 96, '50257', 2] };
  const r3 = row(box); Object.entries(presets).forEach(([k, [a, b, v, m]]) => button(r3, k, () => { d.v = a; L.v = b; Vs.i.value = v; n.v = m; }));
  const o = out(box);
  const blk = (x, y, w, t, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, 26); ctx.strokeStyle = '#999'; ctx.strokeRect(x, y, w, 26); ctx.fillStyle = C.ink; ctx.fillText(t, x + w / 2, y + 18); };
  return () => {
    const D = DS[d.v], Lv = L.v, V0 = +Vs.v, N0 = NS[n.v], att = 4 * Lv * D * D, ffn = 8 * Lv * D * D, emb = V0 * D, Np = att + ffn + emb;
    ctx.clearRect(0, 0, 600, 250); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    blk(10, 60, 90, 'embed + pos', '#eee');
    ctx.strokeStyle = C.ink; ctx.setLineDash([4, 3]); ctx.strokeRect(120, 20, 360, 110); ctx.setLineDash([]);
    ctx.fillStyle = C.gray; ctx.fillText(`block × ${Lv}`, 300, 16);
    [['LN', 30, '#eee'], ['multi-head attn', 92, 'rgba(31,95,191,.2)'], ['+', 22, '#fff'], ['LN', 30, '#eee'], ['FFN (4d)', 80, 'rgba(46,139,87,.2)'], ['+', 22, '#fff']].reduce((x, [t, w, col]) => { blk(x, 60, w, t, col); return x + w + 8; }, 130);
    ctx.strokeStyle = C.gray; ctx.beginPath(); ctx.moveTo(128, 100); ctx.lineTo(128, 118); ctx.lineTo(256, 118); ctx.lineTo(256, 86); ctx.moveTo(264, 100); ctx.lineTo(264, 122); ctx.lineTo(462, 122); ctx.lineTo(462, 86); ctx.stroke();
    blk(500, 60, 90, 'LM head', '#eee');
    const W = 560, x0 = 20; let x = x0;
    [[att, 'attention', 'rgba(31,95,191,.5)'], [ffn, 'FFN', 'rgba(46,139,87,.5)'], [emb, 'embeddings', 'rgba(212,128,15,.5)']].forEach(([v, t, col]) => {
      const w = W * v / Np; ctx.fillStyle = col; ctx.fillRect(x, 165, w, 34); if (w > 60) { ctx.fillStyle = C.ink; ctx.fillText(`${t} ${pct(v / Np)}`, x + w / 2, 187); } x += w;
    });
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(`N ≈ 12Ld² + Vd = ${big(Np)} parameters`, x0, 225); ctx.font = FONT;
    const fwd = 2 * Np + 2 * Lv * N0 * D, kv = 2 * Lv * N0 * D * 2;
    o.innerHTML = `parameters <b>${big(Np)}</b> (weights in 16-bit: ${f2(2 * Np / 1e9)} GB) &nbsp; forward ≈ ${big(fwd, 'FLOP')} per token, training ≈ ${big(3 * fwd, 'FLOP')} per token &nbsp; KV cache at full context: ${f2(kv / 1e9)} GB`;
  };
};

V.sampling = box => {
  const W = [['mat', 3.2], ['floor', 2.6], ['couch', 2.3], ['bed', 2], ['chair', 1.6], ['rug', 1.5], ['sofa', 1.2], ['table', 0.8], ['roof', 0.5], ['keyboard', 0.3], ['moon', -0.5], ['banana', -1.2]];
  const c = canvas(box, 600, 290), { ctx } = c;
  const r = row(box), T = slider(r, 'temperature T', 0.1, 3, 0.05, 1), k = slider(r, 'top-k', 1, 12, 1, 12), p = slider(r, 'top-p', 0.05, 1, 0.01, 1);
  let counts = null, rs = rng(61);
  button(row(box), 'Sample 100', () => { counts = new Array(12).fill(0); const q = probs(); for (let i = 0; i < 100; i++) { let u = rs(), j = 0; while (j < 11 && (u -= q[j]) > 0) j++; counts[j]++; } });
  const o = out(box);
  const probs = () => {
    const base = soft(W.map(([, z]) => z / T.v)); let cum = 0;
    const keep = base.map((b, i) => { const ok = i < k.v && cum < p.v; cum += b; return ok; });
    const s = sum(base.filter((_, i) => keep[i])); return base.map((b, i) => (keep[i] ? b / s : 0));
  };
  return () => {
    const base = soft(W.map(([, z]) => z / T.v)), q = probs();
    ctx.clearRect(0, 0, 600, 290); ctx.font = '14px Times New Roman';
    W.forEach(([w], i) => {
      const y = 8 + i * 23, kept = q[i] > 0;
      ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(w, 80, y + 15);
      ctx.fillStyle = '#e4e4e4'; ctx.fillRect(88, y + 2, 440 * base[i], 16);
      if (kept) { ctx.fillStyle = 'rgba(31,95,191,.6)'; ctx.fillRect(88, y + 2, 440 * q[i], 16); }
      ctx.textAlign = 'left'; ctx.fillStyle = kept ? C.ink : C.gray; ctx.fillText(kept ? pct(q[i]) : 'filtered', 92 + 440 * Math.max(q[i], base[i]), y + 15);
      if (counts) { ctx.fillStyle = C.red; ctx.fillRect(88 + 440 * counts[i] / 100 - 1, y, 3, 20); }
    });
    ctx.font = FONT;
    o.innerHTML = `${q.filter(v => v > 0).length} candidate tokens kept; greedy decoding would pick "<b>mat</b>"` + (counts ? ' &nbsp; red ticks: share of 100 samples' : '');
  };
};

V.lora = box => {
  const r0 = rng(71), n = 32, unit = () => { const v = range(n).map(() => gauss(r0)), s = Math.hypot(...v); return v.map(x => x / s); };
  const U = range(4).map(unit), Vv = range(4).map(unit), S = [3, 2, 1.2, 0.7];
  const T = range(n).map(i => range(n).map(j => sum(S.map((s, q) => s * U[q][i] * Vv[q][j])) + 0.03 * gauss(r0)));
  const comps = svdTop(T, 16, 3), tot = Math.sqrt(sum(T.flat().map(v => v * v)));
  const c = canvas(box, 600, 360), { ctx } = c;
  const rr = slider(row(box), 'rank r', 1, 16, 1, 2);
  const o = out(box);
  const img = (M, x0, mx) => M.forEach((rw, i) => rw.forEach((v, j) => { const a = Math.min(1, Math.abs(v) / mx); ctx.fillStyle = v > 0 ? `rgba(192,57,43,${a})` : `rgba(31,95,191,${a})`; ctx.fillRect(x0 + j * 8, 22 + i * 8, 8, 8); }));
  return () => {
    const A = range(n).map(() => new Array(n).fill(0));
    comps.slice(0, rr.v).forEach(({ s, u, v }) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A[i][j] += s * u[i] * v[j]; });
    const err = Math.sqrt(sum(T.flat().map((v, i) => (v - A[Math.floor(i / n)][i % n]) ** 2))) / tot, mx = Math.max(...T.flat().map(Math.abs)) * 0.7;
    ctx.clearRect(0, 0, 600, 360); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center'; ctx.fillStyle = C.ink;
    img(T, 30, mx); img(A, 314, mx); ctx.fillStyle = C.ink;
    ctx.fillText('target update ΔW (32 × 32)', 158, 14); ctx.fillText(`B·A with rank ${rr.v}`, 442, 14);
    comps.forEach(({ s }, i) => { const h = 60 * s / comps[0].s; ctx.fillStyle = i < rr.v ? C.blue : '#ccc'; ctx.fillRect(30 + i * 34, 350 - h, 26, h); });
    ctx.textAlign = 'right'; ctx.fillStyle = C.gray; ctx.fillText('singular values of ΔW (blue = kept)', 570, 300); ctx.font = FONT;
    o.innerHTML = `relative error = <b>${pct(err)}</b> &nbsp; toy: ${rr.v}·(32 + 32) = ${rr.v * 64} trainable numbers vs 1,024 &nbsp; at d = k = 4096: ${(rr.v * 8192).toLocaleString()} vs 16,777,216 (${Math.round(16777216 / (rr.v * 8192))}× fewer)`;
  };
};

/* ---------- Part IV, chapters 17 and 18 ---------- */
// A small color scene and a grayscale test image, generated so the page needs no image files.
function sceneRGB(x, y, W, H) {
  const u = x / W, v = y / H;
  if ((u - 0.78) ** 2 + ((v - 0.2) * H / W) ** 2 < 0.006) return [250, 210, 60];
  if (v > 0.72) return [70 + 30 * (x % 2), 150 - 20 * v, 70];
  if (u > 0.18 && u < 0.5 && v > 0.42 && v <= 0.72) return u > 0.28 && u < 0.36 && v > 0.52 && v < 0.62 ? [255, 240, 150] : [190, 60, 50];
  if (v > 0.22 && v <= 0.42 && Math.abs(u - 0.34) < (v - 0.22) * 0.9) return [110, 70, 40];
  return [110 + 80 * v, 160 + 60 * v, 235];
}
function grayImg(W, H) {
  return range(H).map(y => range(W).map(x => {
    const u = x / W, v = y / H;
    let g = 0.25 + 0.25 * u;
    if (u > 0.1 && u < 0.4 && v > 0.15 && v < 0.6) g = 0.9;
    if ((u - 0.68) ** 2 + ((v - 0.4) * H / W) ** 2 < 0.03) g = 0.08;
    if (Math.abs(v - 0.8 - 0.25 * (u - 0.5)) < 0.03) g = 0.75;
    if (u > 0.55 && u < 0.85 && Math.abs(v - 0.75) < 0.012) g = 0.95;
    return g;
  }));
}
const conv2 = (I, K) => { const H = I.length, W = I[0].length, r = (K.length - 1) / 2; return range(H).map(y => range(W).map(x => { let s = 0; K.forEach((row, m) => row.forEach((k, n) => { const yy = y + m - r, xx = x + n - r; if (yy >= 0 && yy < H && xx >= 0 && xx < W) s += I[yy][xx] * k; })); return s; })); };
const grayStyle = v => { const g = Math.round(255 * Math.max(0, Math.min(1, v))); return `rgb(${g},${g},${g})`; };
function hover(c, f) { c.cv.addEventListener('pointermove', e => { const b = c.cv.getBoundingClientRect(); f((e.clientX - b.left) * c.w / b.width, (e.clientY - b.top) * c.h / b.height); closestBox(c.cv).draw(); }); }

V.pixels = box => {
  const W = 32, H = 20, cs = 15, c = canvas(box, 600, 320), { ctx } = c;
  const r = row(box), view = select(r, 'view', ['RGB', 'red channel', 'green channel', 'blue channel', 'grayscale']), grid = check(r, 'grid', true);
  let flip = false, hv = [5, 5];
  button(r, 'Flip horizontally', () => (flip = !flip));
  hover(c, (x, y) => { if (x >= 10 && x < 10 + W * cs && y >= 10 && y < 10 + H * cs) hv = [Math.floor((x - 10) / cs), Math.floor((y - 10) / cs)]; });
  const o = out(box);
  return () => {
    ctx.clearRect(0, 0, 600, 320);
    const px = (x, y) => sceneRGB(flip ? W - 1 - x : x, y, W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [R, G, B] = px(x, y), Y = Math.round(0.299 * R + 0.587 * G + 0.114 * B);
      ctx.fillStyle = { RGB: `rgb(${R},${G},${B})`, 'red channel': `rgb(${R},0,0)`, 'green channel': `rgb(0,${G},0)`, 'blue channel': `rgb(0,0,${B})`, grayscale: `rgb(${Y},${Y},${Y})` }[view.v];
      ctx.fillRect(10 + x * cs, 10 + y * cs, cs, cs);
      if (grid.v) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.strokeRect(10 + x * cs, 10 + y * cs, cs, cs); }
    }
    const [hx, hy] = hv, [R, G, B] = px(hx, hy);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(10 + hx * cs, 10 + hy * cs, cs, cs); ctx.lineWidth = 1;
    ctx.fillStyle = `rgb(${R},${G},${B})`; ctx.fillRect(505, 20, 80, 80); ctx.strokeStyle = '#999'; ctx.strokeRect(505, 20, 80, 80);
    ctx.fillStyle = C.ink; ctx.font = '14px Times New Roman'; ctx.textAlign = 'left';
    [`row ${hy}, col ${hx}`, `R = ${R}`, `G = ${G}`, `B = ${B}`, `gray = ${Math.round(0.299 * R + 0.587 * G + 0.114 * B)}`].forEach((t, i) => ctx.fillText(t, 505, 125 + i * 22));
    ctx.font = FONT;
    o.innerHTML = `image tensor shape: H × W × C = ${H} × ${W} × 3 = ${H * W * 3} numbers` + (flip ? ' &nbsp; (flipped: column x now holds column W − 1 − x)' : '');
  };
};

V.conv = box => {
  const N = 48, I = grayImg(N, N), cs = 6, c = canvas(box, 600, 300), { ctx } = c;
  const KS = {
    identity: [0, 0, 0, 0, 1, 0, 0, 0, 0], 'box blur': Array(9).fill(1 / 9), 'Gaussian blur': [1, 2, 1, 2, 4, 2, 1, 2, 1].map(v => v / 16),
    sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0], Laplacian: [0, 1, 0, 1, -4, 1, 0, 1, 0], 'Sobel x': [-1, 0, 1, -2, 0, 2, -1, 0, 1], emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
  };
  const r = row(box), ks = select(r, 'kernel', Object.keys(KS), 'sharpen');
  const g = el('span', { style: 'display:inline-grid;grid-template-columns:repeat(3,4.2em);gap:3px' }, r);
  const cells = range(9).map(() => el('input', { type: 'number', step: 0.1, style: 'width:4em;font:inherit;font-size:14px' }, g));
  let key, hv = [20, 20];
  hover(c, (x, y) => { if (x >= 310 && x < 310 + N * cs && y >= 6 && y < 6 + N * cs) hv = [Math.floor((x - 310) / cs), Math.floor((y - 6) / cs)]; });
  const o = out(box);
  return () => {
    if (key !== ks.v) { key = ks.v; KS[ks.v].forEach((v, i) => (cells[i].value = +v.toFixed(3))); }
    const k = cells.map(e => +e.value || 0), K = [k.slice(0, 3), k.slice(3, 6), k.slice(6)], O = conv2(I, K), zero = Math.abs(sum(k)) < 1e-6;
    ctx.clearRect(0, 0, 600, 300);
    I.forEach((rw, y) => rw.forEach((v, x) => { ctx.fillStyle = grayStyle(v); ctx.fillRect(10 + x * cs, 6 + y * cs, cs, cs); }));
    O.forEach((rw, y) => rw.forEach((v, x) => { ctx.fillStyle = grayStyle(zero ? Math.abs(v) * 1.5 : v); ctx.fillRect(310 + x * cs, 6 + y * cs, cs, cs); }));
    const [hx, hy] = hv;
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.strokeRect(10 + (hx - 1) * cs, 6 + (hy - 1) * cs, 3 * cs, 3 * cs); ctx.strokeRect(310 + hx * cs, 6 + hy * cs, cs, cs); ctx.lineWidth = 1;
    const terms = [];
    for (let m = 0; m < 3; m++) for (let n = 0; n < 3; n++) { const yy = hy + m - 1, xx = hx + n - 1, v = yy >= 0 && yy < N && xx >= 0 && xx < N ? I[yy][xx] : 0; if (K[m][n]) terms.push(`${f2(K[m][n])}·${f2(v)}`); }
    o.innerHTML = `output(${hy}, ${hx}) = ${terms.join(' + ') || '0'} = <b>${f2(O[hy][hx])}</b>` + (zero ? ' &nbsp; (kernel sums to 0: the display shows |value|)' : '');
  };
};

V.edges = box => {
  const W = 96, H = 64, base = grayImg(W, H), r0 = rng(53), NZ = range(H).map(() => range(W).map(() => gauss(r0)));
  const c = canvas(box, 600, 205), { ctx } = c;
  const r = row(box), view = select(r, 'show', ['Gx', 'Gy', 'magnitude |∇I|', 'thin edges (NMS + threshold)'], 'magnitude |∇I|'), nz = slider(r, 'noise', 0, 0.3, 0.01, 0.08);
  const r2 = row(box), sg = slider(r2, 'blur σ', 0, 2.5, 0.1, 1), th = slider(r2, 'threshold', 0.05, 1.5, 0.05, 0.4);
  const o = out(box);
  return () => {
    let I = base.map((rw, y) => rw.map((v, x) => v + nz.v * NZ[y][x]));
    if (sg.v > 0) { const rad = Math.ceil(3 * sg.v), g = range(2 * rad + 1).map(i => Math.exp(-((i - rad) ** 2) / (2 * sg.v ** 2))), s = sum(g), k = g.map(v => v / s); I = conv2(conv2(I, [k]), k.map(v => [v])); }
    const gx = conv2(I, [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]), gy = conv2(I, [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]);
    const mag = gx.map((rw, y) => rw.map((v, x) => (x < 1 || y < 1 || x > W - 2 || y > H - 2 ? 0 : Math.hypot(v, gy[y][x]))));
    const val = (x, y) => {
      if (view.v === 'Gx') return 0.5 + gx[y][x] / 4;
      if (view.v === 'Gy') return 0.5 + gy[y][x] / 4;
      if (view.v[0] === 'm') return mag[y][x] / 3;
      const m = mag[y][x]; if (m < th.v) return 0;
      const a = ((Math.atan2(gy[y][x], gx[y][x]) * 180 / Math.PI) + 180) % 180, d = a < 22.5 || a >= 157.5 ? [1, 0] : a < 67.5 ? [1, 1] : a < 112.5 ? [0, 1] : [-1, 1];
      const n1 = (mag[y + d[1]] || [])[x + d[0]] || 0, n2 = (mag[y - d[1]] || [])[x - d[0]] || 0;
      return m >= n1 && m >= n2 ? 1 : 0;
    };
    ctx.clearRect(0, 0, 600, 205);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { ctx.fillStyle = grayStyle(I[y][x]); ctx.fillRect(6 + x * 3, 6 + y * 3, 3, 3); ctx.fillStyle = grayStyle(val(x, y)); ctx.fillRect(306 + x * 3, 6 + y * 3, 3, 3); }
    let n = 0; if (view.v[0] === 't') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) n += val(x, y);
    o.innerHTML = `left: input after noise and blur; right: ${view.v}` + (view.v[0] === 't' ? ` &nbsp; ${n} edge pixels` : view.v[0] === 'G' ? ' (gray = 0, white = positive, black = negative)' : '');
  };
};

V.convshape = box => {
  const c = canvas(box, 600, 300), { ctx } = c, r0 = rng(59), VALS = range(81).map(() => Math.floor(r0() * 10)), KW = range(25).map(() => Math.floor(r0() * 3) - 1);
  const r = row(box), Wn = slider(r, 'input W', 3, 9, 1, 6), K = slider(r, 'kernel K', 1, 5, 1, 3), Pd = slider(r, 'padding P', 0, 2, 1, 1), S = slider(r, 'stride S', 1, 3, 1, 1);
  const r2 = row(box), mode = select(r2, 'operation', ['convolution', 'max pooling']), play = check(r2, 'animate', true);
  let t = 0; button(r2, 'Step', () => t++);
  const o = out(box);
  let acc = 0;
  const draw = () => {
    const W = Wn.v, k = K.v, P = Pd.v, s = S.v, Wp = W + 2 * P, Wo = Math.floor((W - k + 2 * P) / s) + 1;
    ctx.clearRect(0, 0, 600, 300); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    if (Wo < 1) { o.innerHTML = `W − K + 2P = ${W - k + 2 * P} &lt; 0: the kernel doesn't fit.`; return; }
    const cs = Math.min(30, 270 / Wp), cs2 = Math.min(30, 220 / Wo), at = (y, x) => (y < P || x < P || y >= P + W || x >= P + W ? 0 : VALS[(y - P) * 9 + (x - P)]);
    const n = t % (Wo * Wo), oy = Math.floor(n / Wo), ox = n % Wo;
    for (let y = 0; y < Wp; y++) for (let x = 0; x < Wp; x++) {
      const pad = y < P || x < P || y >= P + W || x >= P + W;
      ctx.fillStyle = pad ? '#e6e6e6' : '#fff'; ctx.fillRect(10 + x * cs, 20 + y * cs, cs, cs); ctx.strokeStyle = '#bbb'; ctx.strokeRect(10 + x * cs, 20 + y * cs, cs, cs);
      ctx.fillStyle = pad ? '#999' : C.ink; ctx.fillText(at(y, x), 10 + x * cs + cs / 2, 20 + y * cs + cs / 2 + 5);
    }
    ctx.fillStyle = 'rgba(212,128,15,.25)'; ctx.fillRect(10 + ox * s * cs, 20 + oy * s * cs, k * cs, k * cs); ctx.strokeStyle = C.orange; ctx.lineWidth = 2.5; ctx.strokeRect(10 + ox * s * cs, 20 + oy * s * cs, k * cs, k * cs); ctx.lineWidth = 1;
    const outv = (yy, xx) => { let v = mode.v[0] === 'c' ? 0 : -Infinity; for (let m = 0; m < k; m++) for (let q = 0; q < k; q++) { const a = at(yy * s + m, xx * s + q); v = mode.v[0] === 'c' ? v + a * KW[m * 5 + q] : Math.max(v, a); } return v; };
    const X0 = 360;
    for (let y = 0; y < Wo; y++) for (let x = 0; x < Wo; x++) {
      const done = y * Wo + x <= n; ctx.fillStyle = y === oy && x === ox ? 'rgba(212,128,15,.35)' : done ? 'rgba(31,95,191,.12)' : '#fff';
      ctx.fillRect(X0 + x * cs2, 20 + y * cs2, cs2, cs2); ctx.strokeStyle = '#bbb'; ctx.strokeRect(X0 + x * cs2, 20 + y * cs2, cs2, cs2);
      if (done) { ctx.fillStyle = C.ink; ctx.fillText(outv(y, x), X0 + x * cs2 + cs2 / 2, 20 + y * cs2 + cs2 / 2 + 5); }
    }
    ctx.fillStyle = C.gray; ctx.fillText(`input ${W}×${W} + padding`, 10 + Wp * cs / 2, 14); ctx.fillText(`output ${Wo}×${Wo}`, X0 + Wo * cs2 / 2, 14);
    if (mode.v[0] === 'c') { ctx.textAlign = 'left'; ctx.fillText('kernel:', X0, 270); for (let m = 0; m < k; m++) for (let q = 0; q < k; q++) ctx.fillText(KW[m * 5 + q], X0 + 50 + q * 18, 270 + m * 14 - (k - 1) * 7 + 0); }
    ctx.font = FONT;
    o.innerHTML = `W<sub>out</sub> = ⌊(W − K + 2P)/S⌋ + 1 = ⌊(${W} − ${k} + ${2 * P})/${s}⌋ + 1 = <b>${Wo}</b>` + (mode.v[0] === 'c' ? ` &nbsp; parameters per output channel: K²·C<sub>in</sub> + 1 = ${k * k + 1} (with C<sub>in</sub> = 1)` : ' &nbsp; pooling has no parameters');
  };
  loop(box, dt => { if (play.v && (acc += dt) > 0.6) { acc = 0; t++; draw(); } });
  return draw;
};

V.depthwise = box => {
  const c = canvas(box, 600, 200), { ctx } = c;
  const r = row(box), Hs = slider(r, 'output size H = W', 7, 224, 1, 56), K = slider(r, 'kernel K', 1, 7, 2, 3);
  const r2 = row(box), ci = slider(r2, 'C_in', 8, 1024, 8, 128), co = slider(r2, 'C_out', 8, 1024, 8, 128);
  const o = out(box);
  return () => {
    const HW = Hs.v * Hs.v, k2 = K.v * K.v, std = HW * k2 * ci.v * co.v, dw = HW * k2 * ci.v, pw = HW * ci.v * co.v, ps = k2 * ci.v * co.v, pd = k2 * ci.v + ci.v * co.v;
    ctx.clearRect(0, 0, 600, 200); ctx.font = '14px Times New Roman';
    const bar = (y, parts, label) => { let x = 130; ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(label, 122, y + 19); parts.forEach(([v, col, t]) => { const w = 440 * v / std; ctx.fillStyle = col; ctx.fillRect(x, y, Math.max(w, 1), 28); if (w > 70) { ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(t, x + w / 2, y + 19); } x += w; }); };
    bar(30, [[std, 'rgba(192,57,43,.45)', 'K²·C_in·C_out per pixel']], 'standard');
    bar(80, [[dw, 'rgba(31,95,191,.5)', 'depthwise'], [pw, 'rgba(46,139,87,.5)', 'pointwise 1×1']], 'separable');
    ctx.textAlign = 'left'; ctx.fillStyle = C.gray; ctx.fillText('bar length = multiply-adds (standard = full width)', 130, 140); ctx.font = FONT;
    o.innerHTML = `standard: ${big(std)}MACs, ${big(ps)}params &nbsp; separable: ${big(dw + pw)}MACs, ${big(pd)}params &nbsp; ratio = 1/C<sub>out</sub> + 1/K² = <b>${f2((dw + pw) / std)}</b> (${f2(std / (dw + pw))}× cheaper)`;
  };
};

/* ---------- Part IV, chapter 19 ---------- */
const boxIoU = (a, b) => { const w = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])), h = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])), i = w * h; return i / (a[2] * a[3] + b[2] * b[3] - i); };

V.iou = box => {
  const c1 = canvas(box, 600, 240), ctx = c1.ctx, r0 = rng(67);
  const objs = [[100, 70, 110, 90], [340, 60, 140, 120]];
  const cands = objs.flatMap(([x, y, w, h], k) => range(5).map(i => [x + 18 * gauss(r0), y + 14 * gauss(r0), w * (1 + 0.15 * gauss(r0)), h * (1 + 0.15 * gauss(r0)), +(0.95 - 0.12 * i - 0.05 * k - 0.03 * r0()).toFixed(2)]));
  const r = row(box), thr = slider(r, 'NMS IoU threshold', 0.1, 0.9, 0.05, 0.5);
  let kept, sup, key;
  const reset = () => { kept = []; sup = new Set(); };
  const step = () => { const rest = cands.map((b, i) => i).filter(i => !kept.includes(i) && !sup.has(i)).sort((a, b) => cands[b][4] - cands[a][4]); if (!rest.length) return; const top = rest[0]; kept.push(top); rest.slice(1).forEach(i => { if (boxIoU(cands[top], cands[i]) > thr.v) sup.add(i); }); };
  button(r, 'NMS step', step); button(r, 'Run all', () => range(10).forEach(step)); button(r, 'Reset', reset);
  const c2 = canvas(box, 600, 200), P = plot(c2, 0, 600, 200, 0, 0), A = [200, 45, 170, 110], B = { x: 330, y: 110 };
  drag(P, [B]);
  const sz = slider(row(box), 'red box size', 0.4, 1.6, 0.05, 1);
  const o = out(box);
  return () => {
    if (key !== thr.v) { key = thr.v; reset(); }
    ctx.clearRect(0, 0, 600, 240); ctx.font = '12px Times New Roman';
    objs.forEach(([x, y, w, h]) => { ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.42, h * 0.42, 0, 0, 7); ctx.fill(); });
    cands.forEach(([x, y, w, h, s], i) => {
      const k = kept.includes(i), d = sup.has(i);
      ctx.strokeStyle = k ? C.green : d ? '#bbb' : C.blue; ctx.lineWidth = k ? 3 : 1.2; ctx.setLineDash(d ? [4, 3] : []);
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      ctx.fillStyle = k ? C.green : d ? '#aaa' : C.blue; ctx.fillText(s.toFixed(2), x + 2, y - 3);
    });
    ctx.font = FONT;
    const b = [B.x - 85 * sz.v, B.y - 55 * sz.v, 170 * sz.v, 110 * sz.v], iw = Math.max(0, Math.min(A[0] + A[2], b[0] + b[2]) - Math.max(A[0], b[0])), ih = Math.max(0, Math.min(A[1] + A[3], b[1] + b[3]) - Math.max(A[1], b[1]));
    const g = c2.ctx; g.clearRect(0, 0, 600, 200);
    g.fillStyle = 'rgba(31,95,191,.15)'; g.fillRect(...A); g.strokeStyle = C.blue; g.lineWidth = 2; g.strokeRect(...A);
    g.fillStyle = 'rgba(192,57,43,.12)'; g.fillRect(...b); g.strokeStyle = C.red; g.strokeRect(...b);
    if (iw * ih > 0) { g.fillStyle = 'rgba(123,63,160,.45)'; g.fillRect(Math.max(A[0], b[0]), Math.max(A[1], b[1]), iw, ih); }
    P.dot(B.x, B.y, 6, C.red);
    const i2 = iw * ih;
    o.innerHTML = `NMS kept ${kept.length} box(es), suppressed ${sup.size} &nbsp; | &nbsp; IoU = ${Math.round(i2)} / (${Math.round(A[2] * A[3])} + ${Math.round(b[2] * b[3])} − ${Math.round(i2)}) = <b>${f2(boxIoU(A, b))}</b>`;
  };
};

V.ap = box => {
  const S = [0.98, 0.95, 0.91, 0.88, 0.84, 0.77, 0.71, 0.65, 0.58, 0.49, 0.41, 0.33];
  let tp = [1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1];
  const c = canvas(box, 600, 320), { ctx } = c;
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 320 / b.height, i = Math.floor((y - 26) / 23); if (x < 270 && i >= 0 && i < 12) { tp[i] = 1 - tp[i]; closestBox(c.cv).draw(); } });
  const G = slider(row(box), 'ground-truth objects', 1, 12, 1, 8);
  const o = out(box);
  return () => {
    const nT = sum(tp), g = Math.max(G.v, nT); let t = 0;
    const pr = tp.map((v, i) => { t += v; return [t / g, t / (i + 1)]; }), interp = pr.map((_, k) => Math.max(...pr.slice(k).map(q => q[1])));
    let ap = 0, prev = 0; pr.forEach(([rc], k) => { ap += (rc - prev) * interp[k]; prev = rc; });
    ctx.clearRect(0, 0, 600, 320); ctx.font = '13px Times New Roman'; ctx.textAlign = 'left'; ctx.fillStyle = C.gray;
    ctx.fillText('#   score   match   prec.   recall', 12, 18);
    S.forEach((s, i) => {
      const y = 26 + i * 23; ctx.fillStyle = tp[i] ? 'rgba(46,139,87,.18)' : 'rgba(192,57,43,.15)'; ctx.fillRect(8, y, 255, 21);
      ctx.fillStyle = C.ink; ctx.fillText(`${i + 1}`, 12, y + 15); ctx.fillText(s.toFixed(2), 38, y + 15); ctx.fillText(tp[i] ? 'TP' : 'FP', 92, y + 15); ctx.fillText(f2(pr[i][1]), 140, y + 15); ctx.fillText(f2(pr[i][0]), 196, y + 15);
    });
    const X = v => 310 + v * 270, Y = v => 290 - v * 260;
    ctx.strokeStyle = '#ccc'; ctx.strokeRect(310, 30, 270, 260);
    ctx.fillStyle = 'rgba(31,95,191,.18)'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); let rp = 0;
    pr.forEach(([rc], k) => { ctx.lineTo(X(rp), Y(interp[k])); ctx.lineTo(X(rc), Y(interp[k])); rp = rc; }); ctx.lineTo(X(rp), Y(0)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.orange; ctx.lineWidth = 1.5; ctx.beginPath(); pr.forEach(([rc, p], k) => (k ? ctx.lineTo(X(rc), Y(p)) : ctx.moveTo(X(rc), Y(p)))); ctx.stroke(); ctx.lineWidth = 1;
    pr.forEach(([rc, p], k) => { ctx.fillStyle = tp[k] ? C.green : C.red; ctx.beginPath(); ctx.arc(X(rc), Y(p), 3.5, 0, 7); ctx.fill(); });
    ctx.fillStyle = C.gray; ctx.textAlign = 'center'; ctx.fillText('recall', 445, 310); ctx.fillText('precision–recall', 445, 22); ctx.textAlign = 'right'; ctx.fillText('1', 305, 36); ctx.fillText('0', 305, 292);
    ctx.font = FONT;
    o.innerHTML = `${nT} true positives of ${g} objects &nbsp; <b>AP = ${f2(ap)}</b>` + (G.v < nT ? ' &nbsp; (raised the object count to match the true positives)' : '');
  };
};

V.dice = box => {
  const N = 50, gt = (x, y) => ((x - 22) / 14) ** 2 + ((y - 26) / 10) ** 2 <= 1 || (x - 32) ** 2 + (y - 18) ** 2 <= 49;
  const c = canvas(box, 600, 290), P = plot(c, 0, 112, 50, 0, 20), { ctx } = c;
  const p = { x: 26, y: 24 };
  drag(P, [p], q => { q.x = Math.max(0, Math.min(50, q.x)); q.y = Math.max(0, Math.min(50, q.y)); });
  const r = row(box), rad = slider(r, 'radius', 0, 25, 0.5, 11);
  button(r, 'Predict nothing', () => (rad.v = 0));
  const o = out(box);
  return () => {
    let TP = 0, FP = 0, FN = 0, TN = 0;
    ctx.clearRect(0, 0, 600, 290);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const g = gt(x + 0.5, y + 0.5), q = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2 <= rad.v ** 2;
      g && q ? TP++ : q ? FP++ : g ? FN++ : TN++;
      ctx.fillStyle = g && q ? 'rgba(46,139,87,.75)' : q ? 'rgba(212,128,15,.6)' : g ? 'rgba(192,57,43,.6)' : '#f3f3f3';
      ctx.fillRect(P.X(x), P.Y(y), 5, 5);
    }
    if (rad.v > 0) P.dot(p.x, p.y, 5, C.ink);
    const acc = (TP + TN) / (N * N), dice = 2 * TP / (2 * TP + FP + FN || 1), iou = TP / (TP + FP + FN || 1);
    [['pixel accuracy', acc, C.gray], ['IoU', iou, C.purple], ['Dice', dice, C.blue]].forEach(([n, v, col], i) => {
      const y = 40 + i * 70; ctx.fillStyle = C.ink; ctx.font = FONT; ctx.textAlign = 'left'; ctx.fillText(`${n} = ${pct(v)}`, 310, y);
      ctx.fillStyle = '#eee'; ctx.fillRect(310, y + 10, 270, 22); ctx.fillStyle = col; ctx.fillRect(310, y + 10, 270 * v, 22);
    });
    ctx.font = '13px Times New Roman'; ctx.fillStyle = C.gray; ctx.fillText('green: correct   orange: false positive   red: missed', 310, 262); ctx.font = FONT;
    o.innerHTML = `TP = ${TP}, FP = ${FP}, FN = ${FN}, TN = ${TN} &nbsp; Dice = 2·${TP}/(2·${TP} + ${FP} + ${FN}) = <b>${f2(dice)}</b>`;
  };
};

V.vit = box => {
  const S = 96, c = canvas(box, 600, 310), { ctx } = c, IMG = range(S).map(y => range(S).map(x => sceneRGB(x * 32 / S, y * 20 / S * 1.6 - 4, 32, 20)));
  const ps = select(row(box), 'patch size P', ['8', '12', '16', '24', '32', '48'], '24');
  const o = out(box);
  return () => {
    const P = +ps.v, n = S / P, N = n * n;
    ctx.clearRect(0, 0, 600, 310);
    IMG.forEach((rw, y) => rw.forEach(([R, G, B], x) => { ctx.fillStyle = `rgb(${R},${G},${B})`; ctx.fillRect(10 + x * 3, 10 + y * 3, 3, 3); }));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(10 + i * P * 3, 10); ctx.lineTo(10 + i * P * 3, 298); ctx.moveTo(10, 10 + i * P * 3); ctx.lineTo(298, 10 + i * P * 3); ctx.stroke(); }
    if (N <= 64) { ctx.font = `${Math.min(16, P * 1.2)}px Times New Roman`; ctx.textAlign = 'center'; for (let k = 0; k < N; k++) { const x = 10 + (k % n) * P * 3 + P * 1.5, y = 10 + Math.floor(k / n) * P * 3 + P * 1.5 + 5; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(k + 1, x + 1, y + 1); ctx.fillStyle = '#fff'; ctx.fillText(k + 1, x, y); } }
    ctx.font = '13px Times New Roman'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
    ctx.fillText('token sequence:', 320, 24);
    ctx.fillStyle = '#ddd'; ctx.fillRect(320, 34, 30, 30); ctx.fillStyle = C.ink; ctx.fillText('CLS', 323, 54);
    const show = Math.min(N, 7), tw = 30;
    for (let k = 0; k < show; k++) { const px = (k % n) * P, py = Math.floor(k / n) * P, sc = tw / P; for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) { const [R, G, B] = IMG[py + y][px + x]; ctx.fillStyle = `rgb(${R},${G},${B})`; ctx.fillRect(356 + k * (tw + 4) + x * sc, 34 + y * sc, sc + 0.3, sc + 0.3); } }
    if (N > show) { ctx.fillStyle = C.gray; ctx.fillText('…', 360 + show * (tw + 4), 54); }
    ctx.fillStyle = C.ink;
    [`patch size P = ${P}`, `tokens N = (96/${P})² = ${N}, plus [CLS]`, `each token: ${P}·${P}·3 = ${P * P * 3} numbers → d`, `attention matrix: ${N + 1}² = ${((N + 1) ** 2).toLocaleString()} entries`].forEach((t, i) => ctx.fillText(t, 320, 100 + i * 26));
    ctx.font = FONT;
    o.innerHTML = `for a 224 × 224 image with the same P: N = ${Math.floor(224 / P) ** 2} tokens` + (224 % P ? ' (224 is not a multiple of P, so the image would be resized or padded)' : '');
  };
};

V.contrastive = box => {
  const c = canvas(box, 600, 330), P = plot(c, -1.6, 2.97, -1.25, 1.25), { ctx } = c;
  let th = [0.2, 0.9, 1.9, 2.4, 3.3, 4.0, 4.9, 5.6];
  const pair = i => i ^ 1, cols = i => PAL[i >> 1];
  const hs = th.map(t => ({ x: Math.cos(t), y: Math.sin(t) }));
  drag(P, hs, q => { const n = Math.hypot(q.x, q.y) || 1; q.x /= n; q.y /= n; th = hs.map(h => Math.atan2(h.y, h.x)); });
  const r = row(box), tau = slider(r, 'temperature τ', 0.05, 1, 0.01, 0.3);
  let run = false; button(r, 'Train / pause', () => (run = !run)); button(r, 'Shuffle', () => { const q = rng(Math.floor(Math.random() * 1e6) + 1); th = th.map(() => 6.283 * q()); });
  const loss = T => sum(T.map((a, i) => { const z = T.map((b, k) => (k === i ? -Infinity : Math.cos(a - b) / tau.v)), m = Math.max(...z.filter(isFinite)); return -(z[pair(i)] - m - Math.log(sum(z.filter(isFinite).map(v => Math.exp(v - m))))); })) / T.length;
  const o = out(box);
  const draw = () => {
    th.forEach((t, i) => { hs[i].x = Math.cos(t); hs[i].y = Math.sin(t); });
    P.clear();
    P.path(range(101).map(i => [Math.cos(i * Math.PI / 50), Math.sin(i * Math.PI / 50)]), '#bbb', 1);
    th.forEach((t, i) => { if (i % 2 === 0) P.seg(Math.cos(t), Math.sin(t), Math.cos(th[i + 1]), Math.sin(th[i + 1]), cols(i), 1, [3, 3]); });
    th.forEach((t, i) => P.dot(Math.cos(t), Math.sin(t), 7, cols(i), i % 2 === 1));
    const cs = 22, x0 = 395, y0 = 70;
    ctx.font = '12px Times New Roman'; ctx.textAlign = 'center'; ctx.fillStyle = C.gray; ctx.fillText('softmax over candidates (row = anchor)', x0 + 4 * cs, y0 - 12);
    th.forEach((a, i) => { const z = th.map((b, k) => (k === i ? -Infinity : Math.cos(a - b) / tau.v)), pr = soft(z.map(v => (isFinite(v) ? v : -1e9))); pr.forEach((v, k) => { ctx.fillStyle = k === i ? '#f0f0f0' : `rgba(31,95,191,${v})`; ctx.fillRect(x0 + k * cs, y0 + i * cs, cs - 1, cs - 1); if (k === pair(i)) { ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.strokeRect(x0 + k * cs, y0 + i * cs, cs - 1, cs - 1); ctx.lineWidth = 1; } }); ctx.fillStyle = cols(i); ctx.fillRect(x0 - 12, y0 + i * cs + 6, 8, 8); });
    ctx.font = FONT;
    o.innerHTML = `InfoNCE loss = <b>${f2(loss(th))}</b> (orange squares mark the positive partner; training pushes their probability toward 1; with partners together and the pairs 90° apart it would be log(1 + 4e<sup>−1/τ</sup> + 2e<sup>−2/τ</sup>) = ${f2(Math.log(1 + 4 * Math.exp(-1 / tau.v) + 2 * Math.exp(-2 / tau.v)))})`;
  };
  loop(box, () => { if (!run) return; const e = 1e-4, g = th.map((_, i) => { const a = th.slice(), b = th.slice(); a[i] += e; b[i] -= e; return (loss(a) - loss(b)) / (2 * e); }); th = th.map((t, i) => t - 0.05 * tau.v * g[i]); draw(); });
  return draw;
};

/* ---------- Part V, chapter 20 ---------- */
V.vae = box => {
  const c = canvas(box), P = plot(c, -5, 5, -0.15, 1.2);
  const r = row(box), mu = slider(r, 'μ', -3, 3, 0.05, 1.2), sg = slider(r, 'σ', 0.1, 2.5, 0.05, 0.5);
  let r0 = rng(83), E = range(25).map(() => gauss(r0));
  button(row(box), 'New ε draws', () => { r0 = rng(Math.floor(Math.random() * 1e6) + 1); E = range(25).map(() => gauss(r0)); });
  const o = out(box);
  return () => {
    P.y1 = Math.max(1.2, 1.1 / (sg.v * Math.sqrt(2 * Math.PI)));
    P.clear(); P.axes();
    P.fn(x => normPdf(x, 0, 1), C.gray, 2, [6, 4]); P.fn(x => normPdf(x, mu.v, sg.v), C.blue, 2.5);
    E.forEach(e => P.dot(mu.v + sg.v * e, -0.07, 4, C.purple));
    const kl = 0.5 * (mu.v ** 2 + sg.v ** 2 - 1 - Math.log(sg.v ** 2));
    o.innerHTML = `KL(q ‖ p) = ½(μ² + σ² − 1 − log σ²) = <b>${f2(kl)}</b> nats &nbsp; ∂z/∂μ = 1, ∂z/∂σ = ε: the gradient reaches the encoder through each sample`;
  };
};

V.gan = box => {
  const sets = {
    'one Gaussian': { pdf: x => normPdf(x, 2, 0.6), draw: r => 2 + 0.6 * gauss(r) },
    'two Gaussians': { pdf: x => 0.5 * normPdf(x, -1.5, 0.45) + 0.5 * normPdf(x, 2.5, 0.45), draw: r => (r() < 0.5 ? -1.5 : 2.5) + 0.45 * gauss(r) },
  };
  const c = canvas(box), P = plot(c, -5, 6, 0, 1.1);
  const r = row(box), ds = select(r, 'data', Object.keys(sets)), lr = slider(r, 'generator learning rate', 0.005, 0.1, 0.005, 0.03);
  let a, b, w, steps, run = false, key, rs = rng(89);
  const D = x => { const u = x / 3; return sigmoid(w[0] + w[1] * u + w[2] * u * u); };
  const reset = () => { a = 0.4; b = -2.5; w = [0, 0, 0]; steps = 0; };
  const step = () => {
    const S = sets[ds.v], m = 64;
    for (let k = 0; k < 5; k++) { // the discriminator takes 5 steps per generator step, or the generator collapses
      const gw = [0, 0, 0];
      for (let i = 0; i < m; i++) {
        const xr = S.draw(rs), xf = a * gauss(rs) + b;
        [[xr, D(xr) - 1], [xf, D(xf)]].forEach(([x, g]) => { const u = x / 3; gw[0] += g; gw[1] += g * u; gw[2] += g * u * u; });
      }
      w = w.map((v, j) => v - 0.5 * gw[j] / m);
    }
    let ga = 0, gb = 0;
    for (let i = 0; i < m; i++) { const z = gauss(rs), x = a * z + b, u = x / 3, dx = -(1 - D(x)) * (w[1] + 2 * w[2] * u) / 3; ga += dx * z; gb += dx; }
    a = Math.max(0.05, a - lr.v * ga / m); b -= lr.v * gb / m; steps++;
  };
  const r2 = row(box); button(r2, 'Train / pause', () => (run = !run)); button(r2, 'Step', step); button(r2, 'Reset', reset);
  const o = out(box);
  const draw = () => {
    if (key !== ds.v) { key = ds.v; reset(); run = false; }
    const S = sets[ds.v];
    P.clear(); P.axes();
    P.path([[-5, 0], ...range(201).map(i => { const x = -5 + 11 * i / 200; return [x, S.pdf(x)]; }), [6, 0]], null, 1, true, 'rgba(0,0,0,.12)');
    P.fn(x => normPdf(x, b, a), C.blue, 2.5); P.fn(D, C.red, 2); P.seg(-5, 0.5, 6, 0.5, C.red, 1, [4, 4]);
    o.innerHTML = `step ${steps} &nbsp; generator G(z) = ${f2(a)}·z + ${f2(b)} &nbsp; D(real mean) = ${f2(D(ds.v === 'one Gaussian' ? 2 : 2.5))}, D(fake mean) = ${f2(D(b))}`;
  };
  loop(box, () => { if (run) { for (let i = 0; i < 3; i++) step(); draw(); } });
  return draw;
};

V.diffusion = box => {
  const T = 100, r0 = rng(97), X0 = range(250).map(() => { const t = 0.25 + 0.75 * r0(), a = 3 * Math.PI * t; return [1.9 * t * Math.cos(a) + 0.04 * gauss(r0), 1.9 * t * Math.sin(a) + 0.04 * gauss(r0)]; });
  const EP = X0.map(() => [gauss(r0), gauss(r0)]), f0 = Math.cos((0.008 / 1.008) * Math.PI / 2) ** 2;
  const ab = t => Math.max(1e-5, Math.min(0.99999, Math.cos(((t / T + 0.008) / 1.008) * Math.PI / 2) ** 2 / f0));
  const c = canvas(box, 600, 380), P = plot(c, -4.03, 4.03, -2.4, 2.4);
  const r = row(box), tt = slider(r, 'forward step t', 0, T, 1, 30);
  let S = null, ts = T, run = false;
  button(r, 'Generate', () => { const q = rng(Math.floor(Math.random() * 1e6) + 1); S = range(200).map(() => [gauss(q), gauss(q)]); ts = T; run = true; });
  button(r, 'Clear samples', () => { S = null; run = false; });
  const denoise = (x, t) => {
    const a = Math.sqrt(ab(t)), v = 1 - ab(t), lw = X0.map(p => -((x[0] - a * p[0]) ** 2 + (x[1] - a * p[1]) ** 2) / (2 * v)), m = Math.max(...lw), w = lw.map(l => Math.exp(l - m)), s = sum(w);
    return [sum(w.map((q, i) => q * X0[i][0])) / s, sum(w.map((q, i) => q * X0[i][1])) / s];
  };
  const step = () => {
    if (ts <= 0) { run = false; return; }
    const a = ab(ts), ap = ts - 1 === 0 ? 1 : ab(ts - 1);
    S = S.map(x => { const x0 = denoise(x, ts), e = [(x[0] - Math.sqrt(a) * x0[0]) / Math.sqrt(1 - a), (x[1] - Math.sqrt(a) * x0[1]) / Math.sqrt(1 - a)]; return [Math.sqrt(ap) * x0[0] + Math.sqrt(1 - ap) * e[0], Math.sqrt(ap) * x0[1] + Math.sqrt(1 - ap) * e[1]]; });
    ts--;
  };
  const o = out(box);
  const draw = () => {
    const a = ab(tt.v);
    P.clear(); P.axes(false);
    X0.forEach(p => P.dot(p[0], p[1], 2, '#ccc'));
    if (S) S.forEach(p => P.dot(p[0], p[1], 2.8, C.orange));
    else X0.forEach((p, i) => P.dot(Math.sqrt(a) * p[0] + Math.sqrt(1 - a) * EP[i][0], Math.sqrt(a) * p[1] + Math.sqrt(1 - a) * EP[i][1], 2.8, C.blue));
    o.innerHTML = S ? `reverse process: step t = ${ts} of ${T}` + (ts === 0 ? ' (done)' : '') : `forward process: t = ${tt.v}, ᾱ<sub>t</sub> = ${f2(a)}, so x<sub>t</sub> = ${f2(Math.sqrt(a))}·x₀ + ${f2(Math.sqrt(1 - a))}·ε`;
  };
  loop(box, () => { if (run) { step(); step(); draw(); } });
  return draw;
};

/* ---------- Part VI, chapter 21 ---------- */
function gammaS(k, r) { // Marsaglia–Tsang
  if (k < 1) return gammaS(k + 1, r) * Math.pow(r(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = gauss(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
const betaS = (a, b, r) => { const x = gammaS(a, r); return x / (x + gammaS(b, r)); };

// Gridworld shared by value iteration and Q-learning. Cell types: 0 empty, 1 wall, 2 goal (+1), 3 pit (−1).
const GW = 6, GH = 5, MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]], ARROW = ['↑', '→', '↓', '←'];
const defaultGrid = () => { const g = new Array(GW * GH).fill(0); g[5] = 2; g[11] = 3; [7, 8, 16, 19, 27].forEach(i => (g[i] = 1)); return g; };
const gwMove = (g, s, a) => { const x = s % GW, y = Math.floor(s / GW), nx = x + MOVES[a][0], ny = y + MOVES[a][1]; return nx < 0 || ny < 0 || nx >= GW || ny >= GH || g[ny * GW + nx] === 1 ? s : ny * GW + nx; };
const gwReward = (g, s, live) => (g[s] === 2 ? 1 : g[s] === 3 ? -1 : live);
function gwDraw(ctx, g, val, pol, agent) {
  const cs = 70, x0 = 15, y0 = 8;
  ctx.clearRect(0, 0, 600, 370); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
  g.forEach((t, s) => {
    const x = x0 + (s % GW) * cs, y = y0 + Math.floor(s / GW) * cs, v = val[s];
    ctx.fillStyle = t === 1 ? '#555' : t === 2 ? 'rgba(46,139,87,.75)' : t === 3 ? 'rgba(192,57,43,.75)' : v >= 0 ? `rgba(46,139,87,${Math.min(0.6, v * 0.7)})` : `rgba(192,57,43,${Math.min(0.6, -v * 0.7)})`;
    ctx.fillRect(x, y, cs - 2, cs - 2);
    ctx.fillStyle = t ? '#fff' : C.ink;
    if (t === 2 || t === 3) { ctx.font = FONT; ctx.fillText(t === 2 ? '+1' : '−1', x + cs / 2, y + cs / 2 + 5); ctx.font = '13px Times New Roman'; }
    else if (t === 0) { ctx.fillText(f2(v), x + cs / 2, y + cs - 10); if (pol[s] >= 0) { ctx.font = '22px Times New Roman'; ctx.fillText(ARROW[pol[s]], x + cs / 2, y + 30); ctx.font = '13px Times New Roman'; } }
  });
  if (agent != null) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x0 + (agent % GW) * cs + cs / 2, y0 + Math.floor(agent / GW) * cs + cs / 2, 9, 0, 7); ctx.fill(); }
  ctx.font = FONT;
}

V.bandit = box => {
  const c1 = canvas(box, 600, 220), P = plot(c1, 0, 1000, 0, 60), c2 = canvas(box, 600, 140), { ctx } = c2;
  const r = row(box), eps = slider(r, 'ε for ε-greedy', 0.01, 0.5, 0.01, 0.1);
  let seed = 3, mus = [0.3, 0.5, 0.45, 0.7, 0.6];
  button(r, 'New arms', () => { seed++; const q = rng(seed * 13); mus = range(5).map(() => +(0.2 + 0.6 * q()).toFixed(2)); });
  const o = out(box), names = ['ε-greedy', 'UCB1', 'Thompson'];
  return () => {
    const best = Math.max(...mus), res = names.map((_, m) => {
      const q = rng(seed * 101 + m), n = new Array(5).fill(0), s = new Array(5).fill(0), reg = [0]; let R = 0;
      for (let t = 1; t <= 1000; t++) {
        let a;
        if (m === 0) a = q() < eps.v || t <= 5 ? Math.floor(q() * 5) : s.map((v, i) => v / (n[i] || 1)).reduce((b, v, i, A) => (v > A[b] ? i : b), 0);
        else if (m === 1) a = t <= 5 ? t - 1 : s.map((v, i) => v / n[i] + Math.sqrt(2 * Math.log(t) / n[i])).reduce((b, v, i, A) => (v > A[b] ? i : b), 0);
        else a = range(5).map(i => betaS(1 + s[i], 1 + n[i] - s[i], q)).reduce((b, v, i, A) => (v > A[b] ? i : b), 0);
        const rw = q() < mus[a] ? 1 : 0; n[a]++; s[a] += rw; R += best - mus[a]; reg.push(R);
      }
      return { n, reg };
    });
    P.y1 = Math.max(10, ...res.map(x => x.reg[1000])) * 1.1;
    P.clear(); P.axes(); res.forEach((x, m) => P.path(x.reg.map((v, t) => [t, v]), PAL[m], 2)); P.text('cumulative regret', 10, P.y1 * 0.95, C.gray);
    ctx.clearRect(0, 0, 600, 140); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    mus.forEach((mu, i) => {
      const x = 40 + i * 112; ctx.fillStyle = C.ink; ctx.fillText(`arm ${i + 1}: p = ${mu}${mu === best ? ' ★' : ''}`, x + 40, 134);
      res.forEach((rr, m) => { const h = 100 * rr.n[i] / 1000; ctx.fillStyle = PAL[m]; ctx.fillRect(x + m * 27, 115 - h, 22, h); });
    });
    ctx.font = FONT;
    o.innerHTML = names.map((nm, m) => `<span style="color:${PAL[m]}">■ ${nm}: regret ${f2(res[m].reg[1000])}</span>`).join(' &nbsp; ');
  };
};

V.valueiter = box => {
  const c = canvas(box, 600, 370), { ctx } = c;
  const r = row(box), gam = slider(r, 'γ', 0.5, 0.99, 0.01, 0.9), slip = slider(r, 'slip', 0, 0.4, 0.05, 0.2), live = slider(r, 'step reward', -0.2, 0.05, 0.01, -0.02);
  let g = defaultGrid(), V0 = new Array(GW * GH).fill(0), sweeps = 0, run = false, delta = 0;
  const Q = (s, a) => sum([[a, 1 - slip.v], [(a + 1) % 4, slip.v / 2], [(a + 3) % 4, slip.v / 2]].map(([b, p]) => { const s2 = gwMove(g, s, b); return p * (gwReward(g, s2, live.v) + gam.v * (g[s2] >= 2 ? 0 : V0[s2])); }));
  const sweep = () => { delta = 0; const N = V0.map((v, s) => { if (g[s]) return 0; const b = Math.max(...range(4).map(a => Q(s, a))); delta = Math.max(delta, Math.abs(b - v)); return b; }); V0 = N; sweeps++; if (delta < 1e-4) run = false; };
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = Math.floor(((e.clientX - b.left) * 600 / b.width - 15) / 70), y = Math.floor(((e.clientY - b.top) * 370 / b.height - 8) / 70); if (x >= 0 && x < GW && y >= 0 && y < GH) { const s = y * GW + x; g[s] = (g[s] + 1) % 4; V0 = V0.map(() => 0); sweeps = 0; closestBox(c.cv).draw(); } });
  const r2 = row(box); button(r2, 'Sweep', sweep); button(r2, 'Run / pause', () => (run = !run)); button(r2, 'Reset values', () => { V0 = V0.map(() => 0); sweeps = 0; }); button(r2, 'Default grid', () => { g = defaultGrid(); V0 = V0.map(() => 0); sweeps = 0; });
  const o = out(box);
  let acc = 0;
  const draw = () => {
    const pol = g.map((t, s) => (t ? -1 : sweeps ? range(4).reduce((b, a) => (Q(s, a) > Q(s, b) ? a : b), 0) : -1));
    gwDraw(ctx, g, V0, pol);
    ctx.fillStyle = C.gray; ctx.font = '13px Times New Roman'; ctx.textAlign = 'left';
    ['click a cell to change it:', 'empty → wall → goal → pit'].forEach((t, i) => ctx.fillText(t, 445, 30 + i * 18)); ctx.font = FONT;
    o.innerHTML = `${sweeps} sweeps, largest change in the last sweep = ${f2(delta)}` + (sweeps && delta < 1e-4 ? ' &nbsp; <b>converged</b>' : '');
  };
  loop(box, dt => { if (run && (acc += dt) > 0.25) { acc = 0; sweep(); draw(); } });
  return draw;
};

V.qlearn = box => {
  const c = canvas(box, 600, 370), { ctx } = c, g = defaultGrid(), start = 24;
  const r = row(box), al = slider(r, 'α', 0.05, 1, 0.05, 0.5), ep = slider(r, 'ε', 0, 0.5, 0.01, 0.1), gam = slider(r, 'γ', 0.5, 0.99, 0.01, 0.9);
  const r2 = row(box), speed = slider(r2, 'steps per frame', 1, 50, 1, 2);
  let Qt, s, eps, steps, ret, lastRet, run = false, rs = rng(101);
  const reset = () => { Qt = g.map(() => [0, 0, 0, 0]); s = start; eps = 0; steps = 0; ret = 0; lastRet = null; };
  reset();
  button(r2, 'Run / pause', () => (run = !run)); button(r2, 'Reset', reset);
  const act = () => { if (rs() < ep.v) return Math.floor(rs() * 4); const q = Qt[s], m = Math.max(...q), best = range(4).filter(a => q[a] === m); return best[Math.floor(rs() * best.length)]; };
  const stepQ = () => {
    const a = act(), s2 = gwMove(g, s, a), rw = gwReward(g, s2, -0.02), term = g[s2] >= 2;
    Qt[s][a] += al.v * (rw + (term ? 0 : gam.v * Math.max(...Qt[s2])) - Qt[s][a]);
    ret += rw; steps++; s = s2;
    if (term || steps >= 100) { eps++; lastRet = ret; ret = 0; steps = 0; s = start; }
  };
  const o = out(box);
  const draw = () => {
    const val = Qt.map(q => Math.max(...q)), pol = g.map((t, i) => (t || Math.max(...Qt[i]) === 0 && Math.min(...Qt[i]) === 0 ? -1 : Qt[i].indexOf(Math.max(...Qt[i]))));
    gwDraw(ctx, g, val, pol, s);
    o.innerHTML = `episodes finished: ${eps} &nbsp; return of the last episode: ${lastRet == null ? '—' : f2(lastRet)} &nbsp; (each step costs 0.02)`;
  };
  loop(box, () => { if (run) { for (let i = 0; i < speed.v; i++) stepQ(); draw(); } });
  return draw;
};

V.pg = box => {
  const c1 = canvas(box, 600, 160), P1 = plot(c1, 0, 300, 0, 1), c2 = canvas(box, 600, 160), P2 = plot(c2, 0, 300, 0, 1);
  const r = row(box), al = slider(r, 'learning rate α', 0.005, 0.2, 0.005, 0.05), off = slider(r, 'constant added to rewards', 0, 20, 0.5, 0);
  let seed = 1; button(r, 'New runs', () => seed++);
  const o = out(box), means = [1, 1.5, 2];
  return () => {
    const runs = [0, 1].map(bl => range(10).map(k => {
      const q = rng(seed * 1000 + k * 7 + bl), th = [0, 0, 0]; let b = null; const tr = [];
      for (let t = 0; t < 300; t++) {
        const p = soft(th); tr.push(p[2]);
        let u = q(), a = 0; while (a < 2 && (u -= p[a]) > 0) a++;
        const rw = means[a] + gauss(q) + off.v; if (b == null) b = rw;
        const adv = bl ? rw - b : rw; th.forEach((_, i) => (th[i] += al.v * adv * ((i === a) - p[i]))); b += 0.05 * (rw - b);
      }
      return tr;
    }));
    [[P1, runs[0], C.red, 'no baseline'], [P2, runs[1], C.blue, 'with baseline']].forEach(([P, rr, col, t]) => { P.clear(); P.axes(); rr.forEach(tr => P.path(tr.map((v, i) => [i, v]), col + 'aa', 1.2)); P.text(`π(best arm), ${t}`, 5, 0.93, C.gray); });
    const fin = rr => { const v = rr.map(tr => tr[299]), m = sum(v) / 10; return [m, Math.sqrt(sum(v.map(x => (x - m) ** 2)) / 10)]; };
    const [m0, s0] = fin(runs[0]), [m1, s1] = fin(runs[1]);
    o.innerHTML = `after 300 steps, π(best arm): <span style="color:${C.red}">no baseline ${f2(m0)} ± ${f2(s0)}</span> &nbsp; <span style="color:${C.blue}">with baseline ${f2(m1)} ± ${f2(s1)}</span>`;
  };
};

V.ppo = box => {
  const c = canvas(box), P = plot(c, 0, 2.5, -2.5, 2.5);
  const r = row(box), A = slider(r, 'advantage Â', -2, 2, 0.1, 1), e = slider(r, 'ε', 0.05, 0.5, 0.01, 0.2);
  const o = out(box);
  return () => {
    const clip = x => Math.max(1 - e.v, Math.min(1 + e.v, x)), L = x => Math.min(x * A.v, clip(x) * A.v);
    P.clear(); P.axes();
    const flat = A.v >= 0 ? [1 + e.v, 2.5] : [0, 1 - e.v];
    P.rect(flat[0], -2.5, flat[1], 2.5, 'rgba(0,0,0,.06)');
    P.seg(1 - e.v, -2.5, 1 - e.v, 2.5, C.gray, 1, [3, 3]); P.seg(1 + e.v, -2.5, 1 + e.v, 2.5, C.gray, 1, [3, 3]);
    P.fn(x => x * A.v, C.gray, 1.5, [6, 4]); P.fn(L, C.blue, 3);
    P.text('1 − ε', 1 - e.v, -2.3, C.gray, 'right', -3); P.text('1 + ε', 1 + e.v, -2.3, C.gray, 'left', 3);
    o.innerHTML = A.v >= 0 ? `Â &gt; 0: raising r helps up to r = 1 + ε = ${f2(1 + e.v)}; past that the objective is flat (gradient 0)` : `Â &lt; 0: lowering r helps down to r = 1 − ε = ${f2(1 - e.v)}; below that the objective is flat (gradient 0)`;
  };
};

V.dpo = box => {
  const names = ['A', 'B', 'C', 'D'], ref = [0.25, 0.35, 0.25, 0.15], pairs = [[0, 1], [0, 2], [2, 3]];
  const c = canvas(box, 600, 230), { ctx } = c;
  const r = row(box), beta = slider(r, 'β', 0.05, 2, 0.05, 0.5);
  let th, steps, run = false;
  const reset = () => { th = ref.map(Math.log); steps = 0; };
  reset();
  const margin = ([w, l]) => beta.v * ((th[w] - th[l]) - (Math.log(ref[w]) - Math.log(ref[l])));
  const step = () => { const g = [0, 0, 0, 0]; pairs.forEach(pq => { const k = (1 - sigmoid(margin(pq))) * beta.v; g[pq[0]] += k; g[pq[1]] -= k; }); th = th.map((v, i) => v + 0.5 * g[i]); steps++; };
  const r2 = row(box); button(r2, 'Train / pause', () => (run = !run)); button(r2, 'Step', step); button(r2, 'Reset', reset);
  const o = out(box);
  const draw = () => {
    const p = soft(th);
    ctx.clearRect(0, 0, 600, 230); ctx.font = FONT; ctx.textAlign = 'center';
    names.forEach((n, i) => {
      const x = 70 + i * 130, H = 170;
      ctx.fillStyle = '#d5d5d5'; ctx.fillRect(x, 200 - H * ref[i], 40, H * ref[i]);
      ctx.fillStyle = 'rgba(31,95,191,.75)'; ctx.fillRect(x + 44, 200 - H * p[i], 40, H * p[i]);
      ctx.fillStyle = C.ink; ctx.fillText(n, x + 42, 222); ctx.font = '12px Times New Roman'; ctx.fillText(f2(ref[i]), x + 20, 195 - H * ref[i]); ctx.fillText(f2(p[i]), x + 64, 195 - H * p[i]); ctx.font = FONT;
    });
    const L = sum(pairs.map(pq => -Math.log(sigmoid(margin(pq)))));
    o.innerHTML = `step ${steps} &nbsp; DPO loss = <b>${f2(L)}</b> &nbsp; ` + pairs.map(pq => `P(${names[pq[0]]} ≻ ${names[pq[1]]}) = ${f2(sigmoid(margin(pq)))}`).join(', ') + ' &nbsp; (gray: π<sub>ref</sub>, blue: π<sub>θ</sub>)';
  };
  let acc = 0;
  loop(box, dt => { if (run && (acc += dt) > 0.1 && steps < 400) { acc = 0; step(); draw(); } });
  return draw;
};

/* ---------- Part VII, chapter 22 ---------- */
V.gnn = box => {
  const E0 = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [0, 5]], E = [...E0, ...E0.map(([a, b]) => [a + 6, b + 6]), [0, 6]];
  const pos = range(12).map(i => { const k = i % 6, cx = i < 6 ? 150 : 450, a = (k / 6) * 2 * Math.PI + (i < 6 ? 0 : Math.PI); return [cx + 95 * Math.cos(a), 150 + 95 * Math.sin(a)]; });
  const nb = range(12).map(i => [i, ...E.filter(e => e.includes(i)).map(([a, b]) => (a === i ? b : a))]), deg = nb.map(n => n.length);
  const c = canvas(box, 600, 300), { ctx } = c;
  const r = row(box), init = select(r, 'start from', ['one node', 'community labels', 'random']);
  let h, layers, key;
  const reset = () => { const q = rng(7); h = init.v === 'one node' ? range(12).map(i => +(i === 3)) : init.v === 'random' ? range(12).map(() => 2 * q() - 1) : range(12).map(i => (i < 6 ? 1 : -1)); layers = 0; };
  const layer = () => { h = range(12).map(v => sum(nb[v].map(u => h[u] / Math.sqrt(deg[v] * deg[u])))); layers++; };
  button(r, 'One layer', layer); button(r, '10 layers', () => range(10).forEach(layer)); button(r, 'Reset', reset);
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 300 / b.height; const i = pos.findIndex(([px, py]) => Math.hypot(px - x, py - y) < 20); if (i >= 0) { h[i] += 1; closestBox(c.cv).draw(); } });
  const o = out(box);
  return () => {
    if (key !== init.v) { key = init.v; reset(); }
    const mx = Math.max(1e-9, ...h.map(Math.abs));
    ctx.clearRect(0, 0, 600, 300);
    E.forEach(([a, b]) => { ctx.strokeStyle = '#aaa'; ctx.lineWidth = a === 0 && b === 6 ? 3 : 1.5; ctx.beginPath(); ctx.moveTo(...pos[a]); ctx.lineTo(...pos[b]); ctx.stroke(); });
    ctx.font = '12px Times New Roman'; ctx.textAlign = 'center';
    h.forEach((v, i) => {
      const t = v / mx; ctx.fillStyle = t >= 0 ? `rgba(192,57,43,${0.1 + 0.8 * t})` : `rgba(31,95,191,${0.1 - 0.8 * t})`;
      ctx.beginPath(); ctx.arc(...pos[i], 19, 0, 7); ctx.fill(); ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = Math.abs(t) > 0.6 ? '#fff' : C.ink; ctx.fillText(f2(v).slice(0, 6), pos[i][0], pos[i][1] + 4);
    });
    ctx.font = FONT;
    const z = h.map((v, i) => v / Math.sqrt(deg[i])), m = sum(z) / 12, spread = Math.sqrt(sum(z.map(v => (v - m) ** 2)) / 12);
    o.innerHTML = `${layers} layers &nbsp; spread of hᵥ/√dᵥ across nodes = <b>${f2(spread)}</b> (it shrinks toward 0 as the layers over-smooth) &nbsp; click a node to add 1 to it`;
  };
};

/* ---------- Part IV: natural language processing ---------- */
const toks = (s, dots) => s.toLowerCase().match(dots ? /[a-z0-9']+|\./g : /[a-z0-9']+/g) || [];
const esc = s => s.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
function text(box, label, val, size = 34) {
  const r = box.classList && box.classList.contains('ctl') ? box : row(box);
  const l = el('label', {}, r);
  l.append(label + ' ');
  const i = el('input', { type: 'text', value: val, size }, l);
  return { get v() { return i.value; }, i };
}
const STORY = 'the cat sat on the mat . the dog sat on the rug . the cat saw the dog . the dog saw a cat on the mat . a cat ate the fish . the dog ate the bone .';
// Bigram model of STORY with add-k smoothing: '<s>' starts each sentence and '.' ends it.
function bigram() {
  const c = {}, V = new Set();
  let prev = '<s>';
  toks(STORY, true).forEach(w => { (c[prev] ||= {})[w] = (c[prev][w] || 0) + 1; V.add(w); prev = w === '.' ? '<s>' : w; });
  const vocab = [...V];
  const P = (a, b, k) => { const r = c[a] || {}, n = sum(Object.values(r)); return ((r[b] || 0) + k) / (n + k * vocab.length || 1); };
  return { vocab, P };
}
const hbars = (ctx, items, x0, y0, w, hl) => items.forEach(([lab, v], i) => {
  const y = y0 + i * 22; ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(lab, x0 - 6, y + 14);
  ctx.fillStyle = lab === hl ? 'rgba(46,139,87,.7)' : 'rgba(31,95,191,.55)'; ctx.fillRect(x0, y + 3, w * v, 15);
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(f2(v), x0 + w * v + 4, y + 14);
});

V.tfidf = box => {
  const DOCS = ['the cat sat on the mat', 'the dog sat on the log', 'cats and dogs are pets', 'the stock market fell today', 'stock prices rose as the market rallied', 'my cat chased the dog'];
  const D = DOCS.map(d => toks(d)), N = D.length, df = {};
  D.forEach(t => new Set(t).forEach(w => (df[w] = (df[w] || 0) + 1)));
  const c = canvas(box, 600, 250), { ctx } = c;
  const q = text(row(box), 'query', 'cat on a mat'), useIdf = check(row(box), 'use IDF', true);
  const o = out(box);
  const vec = t => { const v = {}; t.forEach(w => (v[w] = (v[w] || 0) + 1 / t.length)); for (const w in v) v[w] *= useIdf.v ? (df[w] ? Math.log(N / df[w]) : 0) : 1; return v; };
  const cos = (a, b) => { let d = 0; for (const w in a) d += a[w] * (b[w] || 0); const n = Math.hypot(...Object.values(a)) * Math.hypot(...Object.values(b)); return n ? d / n : 0; };
  return () => {
    const V = D.map(vec), qv = vec(toks(q.v)), sims = V.map(v => cos(qv, v)), mx = Math.max(...V.flatMap(v => Object.values(v)), 1e-9), best = sims.indexOf(Math.max(...sims));
    ctx.clearRect(0, 0, 600, 250); ctx.font = '15px Times New Roman';
    D.forEach((t, i) => {
      const y = 12 + i * 38; let x = 10;
      t.forEach(w => { const wd = ctx.measureText(w).width + 8; ctx.fillStyle = `rgba(31,95,191,${0.06 + 0.6 * V[i][w] / mx})`; ctx.fillRect(x, y, wd, 24); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(w, x + 4, y + 17); x += wd + 3; });
      ctx.fillStyle = i === best && sims[i] > 0 ? C.green : C.orange; ctx.fillRect(420, y + 4, 150 * sims[i], 16);
      ctx.strokeStyle = '#ccc'; ctx.strokeRect(420, y + 4, 150, 16); ctx.fillStyle = C.ink; ctx.fillText(f2(sims[i]), 574, y + 17);
    });
    ctx.font = FONT;
    const qt = [...new Set(toks(q.v))];
    o.innerHTML = 'idf of the query words: ' + (qt.map(w => `${esc(w)} = ${df[w] ? f2(Math.log(N / df[w])) : 'unseen'}`).join(', ') || '(type a query)') + ` &nbsp; best match: document ${best + 1}`;
  };
};

V.ngram = box => {
  const M = bigram(), ctxs = ['<s>', ...M.vocab.filter(w => w !== '.')];
  const c = canvas(box, 600, 240), { ctx } = c;
  const r = row(box), prev = select(r, 'previous word', ctxs, 'the'), k = slider(r, 'smoothing k', 0, 1, 0.05, 0);
  const test = text(row(box), 'test sentence', 'the cat sat on the rug');
  let gen = [], rs = rng(5);
  button(row(box), 'Generate a sentence', () => {
    let w = '<s>'; const s = [];
    while (s.length < 14) { const ps = M.vocab.map(b => M.P(w, b, k.v)); let u = rs(), j = 0; while (j < ps.length - 1 && (u -= ps[j]) > 0) j++; w = M.vocab[j]; if (w === '.') break; s.push(w); }
    gen = [s.join(' ') + ' .', ...gen].slice(0, 3);
  });
  const o = out(box);
  return () => {
    ctx.clearRect(0, 0, 600, 240); ctx.font = '14px Times New Roman';
    hbars(ctx, M.vocab.map(b => [b, M.P(prev.v, b, k.v)]).sort((a, b) => b[1] - a[1]).slice(0, 10), 100, 4, 420);
    ctx.font = FONT;
    const seq = ['<s>', ...toks(test.v, true).filter(w => w !== '.'), '.'];
    let lp = 0, inf = false;
    for (let i = 1; i < seq.length; i++) { const p = M.P(seq[i - 1], seq[i], k.v); if (p <= 0) inf = true; else lp += Math.log(p); }
    o.innerHTML = `bars: P(next word | "${esc(prev.v)}") &nbsp; perplexity of the test sentence = <b>${inf ? '∞ (it contains a pair the model never saw; raise k)' : f2(Math.exp(-lp / (seq.length - 1)))}</b>` + (gen.length ? '<br>generated: ' + gen.map(esc).join(' &nbsp;|&nbsp; ') : '');
  };
};

V.wordvec = box => {
  const W = { king: [1.2, 1.1], queen: [-1.2, 1.1], man: [1.2, -0.9], woman: [-1.2, -0.9], prince: [1, 0.5], princess: [-1, 0.5], boy: [1, -1.6], girl: [-1, -1.6], crown: [0.1, 1.5], person: [0, -1.1] };
  const names = Object.keys(W), cos = (u, v) => (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  const c = canvas(box, 600, 380), P = plot(c, -3.69, 3.69, -2.2, 2.2);
  const r = row(box), A = select(r, 'a', names, 'king'), B = select(r, '− b', names, 'man'), Cc = select(r, '+ c', names, 'woman');
  const o = out(box);
  return () => {
    const a = W[A.v], b = W[B.v], cc = W[Cc.v], res = [a[0] - b[0] + cc[0], a[1] - b[1] + cc[1]];
    const best = names.filter(n => ![A.v, B.v, Cc.v].includes(n)).sort((x, y) => cos(W[y], res) - cos(W[x], res))[0];
    P.clear(); P.axes(false);
    P.text('male →', 3.6, 0, C.gray, 'right', 0, -6); P.text('← female', -3.6, 0, C.gray, 'left', 0, -6); P.text('royal ↑', 0, 2.1, C.gray, 'left', 6, 8);
    P.arrow(b[0], b[1], a[0], a[1], C.gray, 1.5); P.arrow(cc[0], cc[1], res[0], res[1], C.orange, 2.5);
    names.forEach(n => { P.dot(...W[n], 5, n === best ? C.green : C.blue); P.text(n, W[n][0], W[n][1], C.ink, 'left', 7, -5); });
    P.dot(res[0], res[1], 10, C.orange, true);
    o.innerHTML = `${A.v} − ${B.v} + ${Cc.v} = (${f2(res[0])}, ${f2(res[1])}) → nearest word: <b>${best}</b> (cosine ${f2(cos(W[best], res))})`;
  };
};

V.word2vec = box => {
  const S = ['the cat drinks milk', 'the dog drinks water', 'a cat eats fish', 'a dog eats meat', 'the cat chases the mouse', 'the dog chases the cat', 'we eat bread', 'we eat rice', 'they eat rice', 'they eat bread', 'i drink milk', 'i drink water', 'we drink water', 'they drink milk', 'bread and rice are food', 'milk and water are drinks', 'fish and meat are food'];
  const T = S.map(s => s.split(' ')), Wd = [...new Set(T.flat())], id = Object.fromEntries(Wd.map((w, i) => [w, i])), dim = 10, pairs = [];
  T.forEach(t => t.forEach((w, i) => { for (let j = Math.max(0, i - 2); j <= Math.min(t.length - 1, i + 2); j++) if (j !== i) pairs.push([id[w], id[t[j]]]); }));
  const pw = Wd.map(w => T.flat().filter(x => x === w).length ** 0.75), Z = sum(pw), cdf = []; pw.reduce((a, v, i) => (cdf[i] = a + v / Z), 0);
  const c = canvas(box, 600, 380), P = plot(c, -1, 1, -1, 1);
  const r = row(box), pick = select(r, 'word', Wd, 'cat');
  let E, U, steps, run = false, rs, prevV = null;
  const reset = () => { rs = rng(2); const init = () => Wd.map(() => range(dim).map(() => (rs() - 0.5) * 0.5)); E = init(); U = init(); steps = 0; };
  reset();
  button(r, 'Train / pause', () => (run = !run)); button(r, 'Reset', () => { reset(); run = false; });
  const cos = (a, b) => sum(a.map((x, i) => x * b[i])) / (Math.hypot(...a) * Math.hypot(...b) || 1);
  const train = n => {
    for (let s = 0; s < n; s++) {
      const [ci, oi] = pairs[Math.floor(rs() * pairs.length)], v = E[ci], g = new Array(dim).fill(0);
      [[oi, 1], ...range(4).map(() => { const u = rs(); let i = 0; while (cdf[i] < u) i++; return [i, 0]; })].forEach(([q, lab]) => {
        const u = U[q], e = lab - sigmoid(sum(u.map((x, d) => x * v[d])));
        for (let d = 0; d < dim; d++) { g[d] += e * u[d]; u[d] += 0.05 * e * v[d]; }
      });
      for (let d = 0; d < dim; d++) v[d] += 0.05 * g[d];
    }
    steps += n;
  };
  const o = out(box);
  const draw = () => {
    const m = range(dim).map(d => sum(E.map(e => e[d])) / Wd.length), X = E.map(e => e.map((x, d) => x - m[d]));
    const comps = svdTop(X, 2, 1).map(({ v }, k) => (prevV && sum(v.map((x, d) => x * prevV[k][d])) < 0 ? v.map(x => -x) : v));
    prevV = comps;
    const Y = X.map(x => comps.map(v => sum(x.map((q, d) => q * v[d])))), h = Math.max(1e-6, ...Y.map(y => Math.max(Math.abs(y[0]) / 1.68, Math.abs(y[1])))) * 1.15;
    Object.assign(P, { x0: -1.68 * h, x1: 1.68 * h, y0: -h, y1: h });
    const me = id[pick.v], nn = Wd.map((w, i) => [w, i]).filter(([, i]) => i !== me).sort((a, b) => cos(E[b[1]], E[me]) - cos(E[a[1]], E[me])).slice(0, 3);
    P.clear(); P.axes(false);
    nn.forEach(([, i]) => P.seg(Y[me][0], Y[me][1], Y[i][0], Y[i][1], C.green, 1.5, [4, 3]));
    Wd.forEach((w, i) => { P.dot(Y[i][0], Y[i][1], 4, i === me ? C.green : C.blue); P.text(w, Y[i][0], Y[i][1], C.ink, 'left', 6, -4); });
    o.innerHTML = `${steps.toLocaleString()} training pairs seen &nbsp; nearest to "<b>${pick.v}</b>" (cosine in 10 dimensions): ${nn.map(([w, i]) => `${w} (${f2(cos(E[i], E[me]))})`).join(', ')}`;
  };
  loop(box, () => { if (run) { if (steps < 40000) train(400); else run = false; draw(); } });
  return draw;
};

V.viterbi = box => {
  const tags = ['DET', 'NOUN', 'VERB', 'PREP', 'PRON'], pi = [0.5, 0.2, 0.05, 0.05, 0.2];
  const A = [[0.01, 0.9, 0.04, 0.03, 0.02], [0.05, 0.15, 0.5, 0.25, 0.05], [0.5, 0.15, 0.05, 0.2, 0.1], [0.7, 0.25, 0.01, 0.02, 0.02], [0.05, 0.05, 0.8, 0.05, 0.05]];
  const B = [{ the: 0.7, a: 0.3 }, { dog: 0.35, park: 0.2, walk: 0.25, walks: 0.05, cat: 0.15 }, { walk: 0.3, walks: 0.3, ended: 0.2, saw: 0.2 }, { to: 0.9, in: 0.1 }, { we: 0.6, they: 0.4 }];
  const em = (t, w) => B[t][w] || 1e-4, amax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0), fmt = v => (v >= 0.01 ? v.toFixed(3) : v.toExponential(1));
  const c = canvas(box, 600, 330), { ctx } = c;
  const r = row(box), sel = select(r, 'sentence', ['we walk the dog', 'the walk ended', 'the dog walks to the park']);
  let col = 0, key, run = false, acc = 0;
  button(r, 'Step', () => col++); button(r, 'Run / pause', () => (run = !run)); button(r, 'Reset', () => (col = 0));
  const o = out(box);
  const draw = () => {
    if (key !== sel.v) { key = sel.v; col = 0; run = false; }
    const w = sel.v.split(' '), n = w.length, d = [], psi = [];
    col = Math.min(col, n);
    w.forEach((x, i) => {
      const via = tags.map((_, t) => (i ? tags.map((_, s) => d[i - 1][s] * A[s][t]) : null));
      d.push(tags.map((_, t) => (i ? Math.max(...via[t]) : pi[t]) * em(t, x))); psi.push(via.map(v => (v ? amax(v) : -1)));
    });
    const cw = 470 / n, X = i => 110 + (i + 0.5) * cw, Y = t => 70 + t * 50;
    ctx.clearRect(0, 0, 600, 330); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    w.forEach((x, i) => { ctx.fillStyle = i < col ? C.ink : C.gray; ctx.font = FONT; ctx.fillText(x, X(i), 30); ctx.font = '13px Times New Roman'; });
    tags.forEach((t, k) => { ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(t, 60, Y(k) + 5); ctx.textAlign = 'center'; });
    let path = [];
    if (col === n) { path = [amax(d[n - 1])]; for (let i = n - 1; i > 0; i--) path.unshift(psi[i][path[0]]); }
    for (let i = 0; i < col; i++) tags.forEach((_, t) => {
      if (i) { ctx.strokeStyle = path[i] === t && path[i - 1] === psi[i][t] ? C.orange : '#c8c8c8'; ctx.lineWidth = path[i] === t ? 3 : 1; ctx.beginPath(); ctx.moveTo(X(i) - cw * 0.38, Y(t)); ctx.lineTo(X(i - 1) + cw * 0.38, Y(psi[i][t])); ctx.stroke(); ctx.lineWidth = 1; }
    });
    for (let i = 0; i < col; i++) tags.forEach((_, t) => {
      const best = t === amax(d[i]); ctx.fillStyle = path[i] === t ? 'rgba(212,128,15,.35)' : best ? 'rgba(31,95,191,.18)' : '#f6f6f6';
      ctx.fillRect(X(i) - cw * 0.38, Y(t) - 16, cw * 0.76, 32); ctx.fillStyle = d[i][t] < 1e-6 ? '#bbb' : C.ink; ctx.fillText(fmt(d[i][t]), X(i), Y(t) + 5);
    });
    ctx.font = FONT;
    if (col === n) o.innerHTML = 'best tag sequence: <b>' + w.map((x, i) => `${x}/${tags[path[i]]}`).join(' ') + '</b>';
    else if (col > 0) { const i = col - 1, t = amax(d[i]); o.innerHTML = i ? `best cell in "${w[i]}": δ(${tags[t]}) = δ(${tags[psi[i][t]]}) · A(${tags[psi[i][t]]}→${tags[t]}) · B(${w[i]} | ${tags[t]}) = ${fmt(d[i - 1][psi[i][t]])} · ${A[psi[i][t]][t]} · ${em(t, w[i])} = <b>${fmt(d[i][t])}</b>` : `first word: δ(t) = π(t) · B(${w[0]} | t); best is ${tags[t]} with ${fmt(d[0][t])}`; }
    else o.innerHTML = 'Press Step to fill the first column.';
  };
  loop(box, dt => { if (run && (acc += dt) > 0.7) { acc = 0; if (col < sel.v.split(' ').length) col++; else run = false; draw(); } });
  return draw;
};

V.seq2seq = box => {
  const src = ['the', 'black', 'cat', 'sleeps', 'on', 'the', 'mat'], tgt = ['le', 'chat', 'noir', 'dort', 'sur', 'le', 'tapis'];
  const S = tgt.map(() => src.map(() => 0));
  [[0, 0], [1, 2], [2, 1], [3, 3], [4, 4], [5, 5], [6, 6]].forEach(([t, j]) => (S[t][j] = 3));
  [[1, 1, 1], [2, 2, 1.2], [6, 5, 0.8], [3, 2, 0.6], [5, 6, 0.6]].forEach(([t, j, v]) => (S[t][j] = v));
  const c = canvas(box, 600, 330), { ctx } = c, X = j => 48 + j * 84;
  const sh = slider(row(box), 'sharpness', 0, 3, 0.05, 1.5);
  let sel = 1;
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 330 / b.height; if (y > 120 && y < 175) { sel = Math.max(0, Math.min(6, Math.round((x - 48) / 84))); closestBox(c.cv).draw(); } });
  const o = out(box);
  return () => {
    const Wt = S.map(rw => soft(rw.map(v => v * sh.v)));
    ctx.clearRect(0, 0, 600, 330); ctx.font = '15px Times New Roman'; ctx.textAlign = 'center';
    Wt[sel].forEach((a, j) => { ctx.strokeStyle = `rgba(31,95,191,${0.15 + 0.85 * a})`; ctx.lineWidth = 1 + 12 * a; ctx.beginPath(); ctx.moveTo(X(sel), 128); ctx.lineTo(X(j), 50); ctx.stroke(); });
    ctx.lineWidth = 1;
    src.forEach((w, j) => { ctx.fillStyle = '#f2f2f2'; ctx.fillRect(X(j) - 38, 22, 76, 26); ctx.fillStyle = C.ink; ctx.fillText(w, X(j), 40); });
    tgt.forEach((w, t) => { ctx.fillStyle = t === sel ? 'rgba(212,128,15,.35)' : '#f2f2f2'; ctx.fillRect(X(t) - 38, 130, 76, 26); ctx.fillStyle = C.ink; ctx.fillText(w, X(t), 148); });
    ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'left'; ctx.fillText('source (English)', 8, 14); ctx.fillText('target (French): click a word', 8, 178);
    const cs = 17, hx = 255, hy = 205;
    src.forEach((w, j) => { ctx.save(); ctx.translate(hx + j * cs + 11, hy - 4); ctx.rotate(-Math.PI / 3); ctx.fillText(w, 0, 0); ctx.restore(); });
    tgt.forEach((w, t) => { ctx.textAlign = 'right'; ctx.fillStyle = t === sel ? C.orange : C.gray; ctx.fillText(w, hx - 4, hy + t * cs + 12); Wt[t].forEach((a, j) => { ctx.fillStyle = `rgba(31,95,191,${a})`; ctx.fillRect(hx + j * cs, hy + t * cs, cs - 1, cs - 1); }); });
    ctx.font = FONT;
    const top = Wt[sel].map((a, j) => [a, j]).sort((a, b) => b[0] - a[0]).slice(0, 2);
    o.innerHTML = `"${tgt[sel]}" reads ${top.map(([a, j]) => `${src[j]} (${f2(a)})`).join(' and ')}` + (sh.v === 0 ? ' &nbsp; (sharpness 0: every target word sees the same average, the old fixed-context bottleneck)' : '');
  };
};

V.bert = box => {
  const M = bigram(), cand = M.vocab.filter(w => w !== '.');
  const c = canvas(box, 600, 250), { ctx } = c;
  const sel = select(row(box), 'sentence', ['the dog sat on the rug', 'the cat saw the dog', 'a cat ate the fish', 'the cat sat on the mat']);
  let mi = 2, key, xs = [];
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 250 / b.height; const i = xs.findIndex(([a, z]) => x >= a && x <= z); if (y < 50 && i >= 0) { mi = i; closestBox(c.cv).draw(); } });
  const o = out(box);
  return () => {
    if (key !== sel.v) { key = sel.v; mi = 2; }
    const w = sel.v.split(' '), left = mi ? w[mi - 1] : '<s>', right = mi < w.length - 1 ? w[mi + 1] : '.';
    const L = cand.map(x => M.P(left, x, 0.05)), Bt = cand.map((x, i) => L[i] * M.P(x, right, 0.05)), nl = sum(L), nb = sum(Bt);
    const top = ps => cand.map((x, i) => [x, ps[i]]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    ctx.clearRect(0, 0, 600, 250); ctx.font = FONT; let x = 20; xs = [];
    w.forEach((t, i) => { const s = i === mi ? '[MASK]' : t, wd = ctx.measureText(s).width + 14; ctx.fillStyle = i === mi ? 'rgba(212,128,15,.35)' : '#f2f2f2'; ctx.fillRect(x, 14, wd, 28); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(s, x + 7, 34); xs.push([x, x + wd]); x += wd + 6; });
    ctx.font = '13px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'left';
    ctx.fillText(`left context only ("${left}" → ?)`, 20, 70); ctx.fillText(`both sides ("${left}" → ? → "${right}")`, 320, 70);
    hbars(ctx, top(L.map(v => v / nl)), 80, 78, 180, w[mi]); hbars(ctx, top(Bt.map(v => v / nb)), 380, 78, 180, w[mi]);
    ctx.font = FONT;
    const ci = cand.indexOf(w[mi]);
    o.innerHTML = `hidden word "<b>${w[mi]}</b>": probability ${f2(L[ci] / nl)} from the left context alone, <b>${f2(Bt[ci] / nb)}</b> with both sides`;
  };
};

V.bleu = box => {
  const c = canvas(box, 600, 250), { ctx } = c;
  const ref = text(row(box), 'reference', 'the cat is sitting on the mat'), cand = text(row(box), 'candidate', 'the cat sat on the mat');
  const o = out(box);
  const grams = (t, n) => { const m = new Map(); for (let i = 0; i + n <= t.length; i++) { const g = t.slice(i, i + n).join(' '); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const lcs = (a, b) => { const D = range(a.length + 1).map(() => new Array(b.length + 1).fill(0)); for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) D[i][j] = a[i - 1] === b[j - 1] ? D[i - 1][j - 1] + 1 : Math.max(D[i - 1][j], D[i][j - 1]); return D[a.length][b.length]; };
  const F = (m, a, b) => { const r = a ? m / a : 0, p = b ? m / b : 0; return r + p ? 2 * r * p / (r + p) : 0; };
  return () => {
    const R = toks(ref.v), Cd = toks(cand.v);
    const mt = [1, 2, 3, 4].map(n => { const g = grams(Cd, n), h = grams(R, n); let m = 0, t = 0; g.forEach((v, k) => { t += v; m += Math.min(v, h.get(k) || 0); }); return [m, t]; });
    const pn = mt.map(([m, t]) => (t ? m / t : 0)), bp = Cd.length ? Math.min(1, Math.exp(1 - R.length / Cd.length)) : 0;
    const bleu = pn.every(v => v > 0) ? bp * Math.exp(sum(pn.map(Math.log)) / 4) : 0;
    const smooth = pn[0] > 0 ? bp * Math.exp(sum(mt.map(([m, t], i) => Math.log(i ? (m + 1) / (t + 1) : m / t))) / 4) : 0;
    const left = new Map(grams(R, 1));
    ctx.clearRect(0, 0, 600, 250); ctx.font = '14px Times New Roman';
    [[R, 'reference', 8], [Cd, 'candidate', 46]].forEach(([t, lab, y], row2) => {
      let x = 80; ctx.fillStyle = C.gray; ctx.textAlign = 'right'; ctx.fillText(lab, 72, y + 17);
      t.forEach(w => { const hit = row2 === 1 && (left.get(w) || 0) > 0; if (hit) left.set(w, left.get(w) - 1); const wd = ctx.measureText(w).width + 10; if (x + wd > 595) return; ctx.fillStyle = row2 === 0 ? '#f2f2f2' : hit ? 'rgba(46,139,87,.35)' : 'rgba(192,57,43,.2)'; ctx.fillRect(x, y, wd, 24); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(w, x + 5, y + 17); x += wd + 4; });
    });
    const items = [['p₁', pn[0]], ['p₂', pn[1]], ['p₃', pn[2]], ['p₄', pn[3]], ['BP', bp], ['BLEU', bleu], ['ROUGE-1', F(mt[0][0], R.length, Cd.length)], ['ROUGE-L', F(lcs(R, Cd), R.length, Cd.length)]];
    items.forEach(([lab, v], i) => { const x = 30 + i * 70, h = 120 * v; ctx.fillStyle = i < 5 ? 'rgba(31,95,191,.5)' : i === 5 ? C.green : 'rgba(123,63,160,.55)'; ctx.fillRect(x, 220 - h, 46, h); ctx.strokeStyle = '#ddd'; ctx.strokeRect(x, 100, 46, 120); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(lab, x + 23, 238); ctx.fillText(f2(v), x + 23, 215 - h); });
    ctx.font = FONT;
    o.innerHTML = `BLEU = <b>${f2(bleu)}</b>` + (bleu === 0 && pn[0] > 0 ? ` (a p<sub>n</sub> is 0; with add-one smoothing for n ≥ 2 it would be ${f2(smooth)})` : '') + ` &nbsp; matched n-grams: ${mt.map(([m, t], i) => `${i + 1}-gram ${m}/${t}`).join(', ')} &nbsp; (ROUGE bars show F₁)`;
  };
};

V.rag = box => {
  const KB = ['Phnom Penh is the capital and largest city of Cambodia.', 'The Mekong River flows through Phnom Penh, where it meets the Tonle Sap River.', 'Angkor Wat is a temple complex in Siem Reap province.', 'The Tonle Sap is the largest freshwater lake in Southeast Asia.', 'Gradient descent updates the weights by stepping against the gradient of the loss.', 'The Adam optimizer keeps running averages of the gradients and of their squares.', 'Dropout switches off random units during training to reduce overfitting.', 'BLEU scores a translation by counting n-gram matches with a reference translation.'];
  const D = KB.map(d => toks(d)), N = D.length, avg = sum(D.map(t => t.length)) / N, df = {};
  D.forEach(t => new Set(t).forEach(w => (df[w] = (df[w] || 0) + 1)));
  const idf = w => Math.log((N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5) + 1);
  const c = canvas(box, 600, 290), { ctx } = c;
  const q = text(row(box), 'question', 'Which river flows through Phnom Penh?');
  const r = row(box), k1 = slider(r, 'k₁', 0, 3, 0.1, 1.2), b = slider(r, 'b', 0, 1, 0.05, 0.75), K = slider(r, 'top k', 1, 4, 1, 2);
  const o = out(box);
  return () => {
    const qt = [...new Set(toks(q.v))];
    const sc = D.map(t => sum(qt.map(w => { const f = t.filter(x => x === w).length; return f ? idf(w) * f * (k1.v + 1) / (f + k1.v * (1 - b.v + b.v * t.length / avg)) : 0; })));
    const order = range(N).sort((i, j) => sc[j] - sc[i]), mx = Math.max(...sc, 1e-9);
    ctx.clearRect(0, 0, 600, 290); ctx.font = '13px Times New Roman';
    order.forEach((i, rk) => {
      const y = 6 + rk * 35, top = rk < K.v && sc[i] > 0; let t = KB[i];
      while (ctx.measureText(t).width > 400 && t.length > 10) t = t.slice(0, -4) + '…';
      ctx.fillStyle = top ? 'rgba(46,139,87,.15)' : '#fafafa'; ctx.fillRect(4, y, 592, 31);
      ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(`${rk + 1}. ${t}`, 10, y + 20);
      ctx.fillStyle = top ? C.green : C.blue; ctx.fillRect(430, y + 8, 120 * sc[i] / mx, 15); ctx.fillStyle = C.ink; ctx.fillText(f2(sc[i]), 556, y + 20);
    });
    ctx.font = FONT;
    const ctxt = order.slice(0, K.v).filter(i => sc[i] > 0).map((i, j) => `[${j + 1}] ${KB[i]}`);
    o.innerHTML = `<pre style="white-space:pre-wrap;margin:0;font-size:14px">Context:\n${esc(ctxt.join('\n') || '(nothing matched)')}\nQuestion: ${esc(q.v)}\nAnswer:</pre>`;
  };
};

/* ---------- Part IX: geospatial analysis ---------- */
const RAD = Math.PI / 180;
const hav = (a, b) => { const x = Math.sin((b[0] - a[0]) * RAD / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin((b[1] - a[1]) * RAD / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, x))); };
const xyz = ([la, lo]) => [Math.cos(la * RAD) * Math.cos(lo * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD)];
const lalo = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD];
// Diverging color for t in [0, 1]: blue, white, red.
const div3 = t => { t = Math.max(0, Math.min(1, t)); const m = (a, b) => Math.round(t < 0.5 ? 255 + (a - 255) * (1 - 2 * t) : 255 + (b - 255) * (2 * t - 1)); return `rgb(${m(31, 192)},${m(95, 57)},${m(191, 43)})`; };

V.haversine = box => {
  const CITIES = { 'Phnom Penh': [11.56, 104.92], Bangkok: [13.76, 100.5], Hanoi: [21.03, 105.85], Singapore: [1.35, 103.82], Tokyo: [35.68, 139.69], Sydney: [-33.87, 151.21], London: [51.51, -0.13], 'New York': [40.71, -74.01], 'Los Angeles': [34.05, -118.24], 'Cape Town': [-33.92, 18.42], 'São Paulo': [-23.55, -46.63] };
  const names = Object.keys(CITIES), c = canvas(box, 600, 330), P = plot(c, -180, 180, -90, 90);
  const r = row(box), A = select(r, 'from', names, 'Phnom Penh'), B = select(r, 'to', names, 'New York');
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  let key;
  drag(P, [pa, pb], p => { p.x = Math.max(-180, Math.min(180, p.x)); p.y = Math.max(-85, Math.min(85, p.y)); });
  const o = out(box);
  return () => {
    if (key !== A.v + B.v) { key = A.v + B.v; [pa.y, pa.x] = CITIES[A.v]; [pb.y, pb.x] = CITIES[B.v]; }
    const a = [pa.y, pa.x], b = [pb.y, pb.x], d = hav(a, b), u = xyz(a), v = xyz(b), om = Math.acos(Math.max(-1, Math.min(1, sum(u.map((q, k) => q * v[k])))));
    P.clear();
    for (let lo = -180; lo <= 180; lo += 30) P.seg(lo, -90, lo, 90, '#eee');
    for (let la = -90; la <= 90; la += 30) P.seg(-180, la, 180, la, la ? '#eee' : '#bbb');
    names.forEach(n => { const [la, lo] = CITIES[n]; P.dot(lo, la, 2.5, '#aaa'); });
    const pts = range(121).map(i => (om < 1e-9 ? a : lalo([0, 1, 2].map(k => (Math.sin((1 - i / 120) * om) * u[k] + Math.sin((i / 120) * om) * v[k]) / Math.sin(om)))));
    const segs = [[pts[0]]];
    pts.slice(1).forEach((q, i) => { if (Math.abs(q[1] - pts[i][1]) > 180) segs.push([]); segs[segs.length - 1].push(q); });
    segs.forEach(sg => P.path(sg.map(([la, lo]) => [lo, la]), C.orange, 2.5));
    P.seg(a[1], a[0], b[1], b[0], C.gray, 1.5, [5, 4]);
    P.dot(pa.x, pa.y, 6, C.blue); P.dot(pb.x, pb.y, 6, C.red);
    P.text(A.v, pa.x, pa.y, C.blue, 'left', 7, -6); P.text(B.v, pb.x, pb.y, C.red, 'left', 7, -6);
    const naive = Math.hypot(b[0] - a[0], b[1] - a[1]) * 111.2;
    o.innerHTML = `great-circle (haversine) distance = <b>${Math.round(d).toLocaleString()} km</b> &nbsp; naive √(Δφ² + Δλ²) × 111.2 km = ${Math.round(naive).toLocaleString()} km` + (d > 1 ? ` (off by ${Math.round((100 * (naive - d)) / d)}%)` : '');
  };
};

V.projection = box => {
  const PR = { equirectangular: f => f, Mercator: f => Math.log(Math.tan(Math.PI / 4 + f / 2)), 'equal-area (Lambert)': f => Math.sin(f) };
  const AREA = { equirectangular: f => 1 / Math.cos(f), Mercator: f => 1 / Math.cos(f) ** 2, 'equal-area (Lambert)': () => 1 };
  const c = canvas(box, 600, 380), P = plot(c, -Math.PI, Math.PI, -1.87, 1.87);
  const r = row(box), pr = select(r, 'projection', Object.keys(PR), 'Mercator'), lat = slider(r, 'latitude', 0, 66, 1, 60, v => v + '°');
  const o = out(box);
  const circle = (f0, l0, dl) => range(49).map(i => { const t = (i / 48) * 2 * Math.PI, f = Math.asin(Math.sin(f0) * Math.cos(dl) + Math.cos(f0) * Math.sin(dl) * Math.cos(t)); return [l0 + Math.atan2(Math.sin(t) * Math.sin(dl) * Math.cos(f0), Math.cos(dl) - Math.sin(f0) * Math.sin(f)), f]; });
  return () => {
    const g = PR[pr.v], dl = 7 * RAD;
    P.clear();
    for (let la = -60; la <= 60; la += 30) P.seg(-Math.PI, g(la * RAD), Math.PI, g(la * RAD), la ? '#e6e6e6' : '#bbb');
    for (let lo = -180; lo <= 180; lo += 30) P.seg(lo * RAD, g(-72 * RAD), lo * RAD, g(72 * RAD), '#e6e6e6');
    [-60, -30, 0, 30, 60].forEach(la => [-150, -90, -30, 30, 90, 150].forEach(lo => P.path(circle(la * RAD, lo * RAD, dl).map(([x, f]) => [x, g(f)]), C.blue, 1.5, true, 'rgba(31,95,191,.15)')));
    P.path(circle(lat.v * RAD, 0, dl).map(([x, f]) => [x, g(f)]), C.orange, 2.5, true, 'rgba(212,128,15,.3)');
    o.innerHTML = `${pr.v} at latitude ${lat.v}°: areas appear <b>${f2(AREA[pr.v](lat.v * RAD))}×</b> their true size (orange circle)` + (pr.v === 'Mercator' ? ' &nbsp; (Mercator keeps shapes: the circles stay round)' : '');
  };
};

V.polygon = box => {
  const c = canvas(box, 600, 380), P = plot(c, 0, 10, 0, 5.96);
  const Vx = [[1.5, 1], [5, 0.8], [8.5, 2], [7, 3.2], [8.4, 5], [4.5, 4.2], [2, 5.2], [3, 3]].map(([x, y]) => ({ x, y })), t = { x: 4.2, y: 2.6 };
  drag(P, [...Vx, t], q => { q.x = Math.max(0, Math.min(10, q.x)); q.y = Math.max(0, Math.min(5.96, q.y)); });
  const o = out(box);
  return () => {
    let area = 0; const hits = [];
    Vx.forEach((a, i) => {
      const b = Vx[(i + 1) % Vx.length]; area += a.x * b.y - b.x * a.y;
      if ((a.y > t.y) !== (b.y > t.y)) { const x = a.x + ((t.y - a.y) * (b.x - a.x)) / (b.y - a.y); if (x > t.x) hits.push(x); }
    });
    const inside = hits.length % 2 === 1;
    P.clear(); P.axes();
    P.path(Vx.map(p => [p.x, p.y]), C.blue, 2, true, 'rgba(31,95,191,.12)');
    P.seg(t.x, t.y, 10, t.y, C.orange, 1.5, [5, 4]);
    hits.forEach(x => P.dot(x, t.y, 6, C.orange, true));
    Vx.forEach(p => P.dot(p.x, p.y, 5, C.blue));
    P.dot(t.x, t.y, 7, inside ? C.green : C.red);
    o.innerHTML = `${hits.length} crossing${hits.length === 1 ? '' : 's'} → <b>${inside ? 'inside' : 'outside'}</b> &nbsp; shoelace area = <b>${f2(Math.abs(area) / 2)}</b> km² (axes in km)`;
  };
};

V.ndvi = box => {
  const W = 96, H = 64, NAMES = ['water', 'rice field', 'forest', 'bare soil', 'town'];
  const REFL = [[0.08, 0.07, 0.05, 0.03], [0.04, 0.09, 0.05, 0.42], [0.03, 0.07, 0.03, 0.48], [0.12, 0.16, 0.22, 0.3], [0.16, 0.17, 0.19, 0.22]]; // blue, green, red, NIR
  const cls = (x, y) => { const u = x / W, v = y / H; if (Math.abs(v - (0.25 + 0.35 * u + 0.08 * Math.sin(u * 9))) < 0.06) return 0; if (u > 0.7 && v > 0.62) return 4; if (u < 0.3 && v > 0.55) return 2; return (Math.floor(u * 8) + Math.floor(v * 6)) % 3 === 0 ? 3 : 1; };
  const r0 = rng(29), PX = range(H).map(y => range(W).map(x => { const k = cls(x, y); return [k, ...REFL[k].map(q => q * (1 + 0.08 * gauss(r0)))]; }));
  const nd = p => (p[4] - p[3]) / (p[4] + p[3]);
  const col = v => (v < 0 ? `rgb(70,120,${Math.round(150 - 100 * v)})` : v < 0.2 ? `rgb(${Math.round(200 - 150 * v)},${Math.round(180 - 50 * v)},${Math.round(120 - 100 * v)})` : `rgb(${Math.round(170 - 150 * v)},${Math.round(200 - 60 * v)},${Math.round(80 - 60 * v)})`);
  const c = canvas(box, 600, 395), { ctx } = c;
  const r = row(box), view = select(r, 'view', ['true color', 'red band', 'near-infrared band', 'NDVI', 'vegetation mask'], 'NDVI'), th = slider(r, 'NDVI threshold', -0.2, 0.9, 0.05, 0.4);
  let hv = [20, 20];
  hover(c, (x, y) => { if (x >= 12 && x < 12 + W * 6 && y >= 4 && y < 4 + H * 6) hv = [Math.floor((x - 12) / 6), Math.floor((y - 4) / 6)]; });
  const o = out(box);
  return () => {
    let veg = 0;
    PX.forEach((rw, y) => rw.forEach((p, x) => {
      const v = nd(p); if (v > th.v) veg++;
      ctx.fillStyle = { 'true color': `rgb(${Math.min(255, p[3] * 900)},${Math.min(255, p[2] * 900)},${Math.min(255, p[1] * 1100)})`, 'red band': grayStyle(p[3] * 3.5), 'near-infrared band': grayStyle(p[4] * 1.8), NDVI: col(v), 'vegetation mask': v > th.v ? 'rgb(46,139,87)' : '#e8e8e8' }[view.v];
      ctx.fillRect(12 + x * 6, 4 + y * 6, 6, 6);
    }));
    const [hx, hy] = hv, p = PX[hy][hx];
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(12 + hx * 6, 4 + hy * 6, 6, 6); ctx.lineWidth = 1;
    o.innerHTML = `pixel (${hy}, ${hx}): ${NAMES[p[0]]}, red = ${f2(p[3])}, NIR = ${f2(p[4])}, NDVI = <b>${f2(nd(p))}</b> &nbsp; pixels with NDVI &gt; ${th.v}: ${pct(veg / (W * H))}`;
  };
};

V.moran = box => {
  const n = 12, N = n * n, cs = 24, c = canvas(box, 600, 320), { ctx } = c;
  const pat = select(row(box), 'pattern', ['clusters', 'random', 'checkerboard', 'stripes']);
  let X = [], key;
  const gen = () => { const q = rng(7); X = range(N).map(i => { const x = i % n, y = Math.floor(i / n); return { clusters: +((x - 3) ** 2 + (y - 3) ** 2 < 10 || (x - 8) ** 2 + (y - 8) ** 2 < 12), random: +(q() < 0.4), checkerboard: (x + y) % 2, stripes: +(x % 4 < 2) }[pat.v]; }); };
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = Math.floor(((e.clientX - b.left) * 600 / b.width - 14) / cs), y = Math.floor(((e.clientY - b.top) * 320 / b.height - 14) / cs); if (x >= 0 && y >= 0 && x < n && y < n) { X[y * n + x] = 1 - X[y * n + x]; closestBox(c.cv).draw(); } });
  const moran = v => { const m = sum(v) / N; let num = 0, W = 0, den = 0; for (let i = 0; i < N; i++) { den += (v[i] - m) ** 2; const x = i % n, y = Math.floor(i / n); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n) { num += (v[i] - m) * (v[yy * n + xx] - m); W++; } }); } return den ? (N / W) * num / den : 0; };
  const o = out(box);
  return () => {
    if (key !== pat.v) { key = pat.v; gen(); }
    const I = moran(X), E = -1 / (N - 1), rs = rng(11), sh = X.slice(), null_ = [];
    for (let k = 0; k < 199; k++) { for (let i = N - 1; i > 0; i--) { const j = Math.floor(rs() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; } null_.push(moran(sh)); }
    const pv = (1 + null_.filter(v => Math.abs(v - E) >= Math.abs(I - E)).length) / 200;
    ctx.clearRect(0, 0, 600, 320);
    X.forEach((v, i) => { ctx.fillStyle = v ? C.red : '#e3e3e3'; ctx.fillRect(14 + (i % n) * cs, 14 + Math.floor(i / n) * cs, cs - 2, cs - 2); });
    const X0 = 340, Wd = 240, x = v => X0 + ((v + 1) / 2) * Wd, bins = new Array(24).fill(0);
    null_.forEach(v => bins[Math.max(0, Math.min(23, Math.floor(((v + 1) / 2) * 24)))]++);
    const mx = Math.max(...bins);
    bins.forEach((b, i) => { ctx.fillStyle = 'rgba(120,120,120,.45)'; ctx.fillRect(X0 + i * 10, 250 - 150 * b / mx, 9, 150 * b / mx); });
    ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.moveTo(X0, 250); ctx.lineTo(X0 + Wd, 250); ctx.stroke();
    ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x(I), 80); ctx.lineTo(x(I), 252); ctx.stroke(); ctx.lineWidth = 1;
    ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'center';
    [-1, -0.5, 0, 0.5, 1].forEach(v => ctx.fillText(v, x(v), 266)); ctx.fillText('I after random shuffles (gray) vs observed I (orange)', X0 + Wd / 2, 70); ctx.font = FONT;
    o.innerHTML = `Moran's I = <b>${f2(I)}</b> &nbsp; expected with no pattern: −1/(N − 1) = ${f2(E)} &nbsp; permutation p-value = ${f2(pv)} ` + (I > E ? '(neighbors alike)' : '(neighbors differ)');
  };
};

V.kriging = box => {
  const truth = (x, y) => Math.sin(1.2 * x) * Math.cos(0.9 * y) + 0.6 * Math.exp(-((x - 6.5) ** 2 + (y - 2) ** 2) / 1.5);
  const c = canvas(box, 600, 380), P = plot(c, 0, 10, 0, 5.96), { ctx } = c;
  const r = row(box), meth = select(r, 'method', ['IDW', 'kriging (GP)'], 'kriging (GP)'), view = select(r, 'show', ['prediction', 'kriging std', 'true field']);
  const r2 = row(box), pw = slider(r2, 'IDW power p', 0.5, 6, 0.5, 2), ell = slider(r2, 'length scale ℓ', 0.3, 4, 0.1, 1.2);
  const seed = k => { const q = rng(k); return range(9).map(() => { const x = 0.5 + 9 * q(), y = 0.4 + 5.2 * q(); return [x, y, truth(x, y)]; }); };
  let S = seed(3), sd = 3;
  const r3 = row(box); button(r3, 'New random stations', () => (S = seed(++sd))); button(r3, 'Clear', () => (S = []));
  onClick(P, (x, y) => S.push([x, y, truth(x, y)]));
  const o = out(box);
  return () => {
    const n = S.length, mu = n ? sum(S.map(s => s[2])) / n : 0, k = (a, b, cc, d) => Math.exp(-((a - cc) ** 2 + (b - d) ** 2) / (2 * ell.v ** 2));
    const L = n ? chol(S.map(a => S.map(b => k(a[0], a[1], b[0], b[1]) + (a === b ? 1e-4 : 0)))) : [], al = n ? bwd(L, fwd(L, S.map(s => s[2] - mu))) : [];
    const gp = (x, y) => { if (!n) return [0, 1]; const ks = S.map(s => k(x, y, s[0], s[1])), v = fwd(L, ks); return [mu + sum(ks.map((q, i) => q * al[i])), Math.sqrt(Math.max(0, 1 - sum(v.map(q => q * q))))]; };
    const idw = (x, y) => { if (!n) return 0; let a = 0, b = 0; for (const [sx, sy, z] of S) { const d = Math.hypot(x - sx, y - sy); if (d < 1e-9) return z; const w = d ** -pw.v; a += w * z; b += w; } return a / b; };
    const pred = (x, y) => (meth.v === 'IDW' ? [idw(x, y), 0] : gp(x, y));
    for (let px = 28; px < 572; px += 8) for (let py = 28; py < 352; py += 8) {
      const x = P.ix(px + 4), y = P.iy(py + 4), [m, s] = view.v === 'true field' ? [truth(x, y), 0] : pred(x, y);
      ctx.fillStyle = view.v === 'kriging std' ? (meth.v === 'IDW' ? '#f4f4f4' : `rgba(123,63,160,${Math.min(1, s)})`) : div3((m + 1.6) / 3.2);
      ctx.fillRect(px, py, 8, 8);
    }
    ctx.strokeStyle = '#999'; ctx.strokeRect(28, 28, 544, 324);
    S.forEach(([x, y]) => { P.dot(x, y, 5, '#fff'); P.dot(x, y, 3.5, C.ink); });
    let ei = 0, eg = 0, m = 0;
    for (let i = 0; i < 30; i++) for (let j = 0; j < 18; j++) { const x = (i + 0.5) / 3, y = (j + 0.5) / 3.02, t = truth(x, y); ei += (idw(x, y) - t) ** 2; eg += (gp(x, y)[0] - t) ** 2; m++; }
    o.innerHTML = `${n} stations &nbsp; error against the true field (RMSE): IDW = <b>${f2(Math.sqrt(ei / m))}</b>, kriging = <b>${f2(Math.sqrt(eg / m))}</b>` + (view.v === 'kriging std' && meth.v === 'IDW' ? ' &nbsp; (IDW has no uncertainty estimate; switch the method to kriging)' : '');
  };
};

V.spatialcv = box => {
  const c = canvas(box, 600, 380), P = plot(c, 0, 1.68, 0, 1), { ctx } = c;
  const r = row(box), Ls = slider(r, 'correlation range', 0.04, 0.4, 0.01, 0.15), bs = slider(r, 'block size', 0.05, 0.4, 0.01, 0.2);
  const r2 = row(box), scheme = select(r2, 'show folds of', ['random CV', 'block CV'], 'block CV');
  let sd = 1; button(r2, 'New data', () => sd++);
  const o = out(box);
  let key, bg, f, tr, te;
  const knn = (pts, x, y) => { const d = pts.map(p => [(p[0] - x) ** 2 + (p[1] - y) ** 2, p[2]]).sort((a, b) => a[0] - b[0]).slice(0, 5); return sum(d.map(q => q[1])) / d.length; };
  const cv = folds => { let e = 0; for (let k = 0; k < 5; k++) { const trn = tr.filter((_, i) => folds[i] !== k); tr.forEach((p, i) => { if (folds[i] === k) e += (knn(trn, p[0], p[1]) - p[2]) ** 2; }); } return Math.sqrt(e / tr.length); };
  return () => {
    if (key !== Ls.v + '|' + sd) {
      key = Ls.v + '|' + sd; const q = rng(sd * 31), W = range(40).map(() => [gauss(q) / Ls.v, gauss(q) / Ls.v, 2 * Math.PI * q()]);
      f = (x, y) => Math.sqrt(2 / 40) * sum(W.map(([a, b, ph]) => Math.cos(a * x * 1.68 + b * y + ph)));
      tr = range(150).map(() => { const x = 0.7 * q(), y = q(); return [x, y, f(x, y) + 0.1 * gauss(q)]; });
      te = range(300).map(() => { const x = 0.7 + 0.3 * q(), y = q(); return [x, y, f(x, y) + 0.1 * gauss(q)]; });
      bg = field(P, (x, y) => f(x / 1.68, y), -2.2, 2.2, 14);
    }
    const qr = rng(sd * 7), shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(qr() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const rf = shuffle(range(150).map(i => i % 5)), cell = ([x, y]) => Math.floor(x / bs.v) + ',' + Math.floor(y / bs.v);
    const blockFold = Object.fromEntries(shuffle([...new Set(tr.map(cell))]).map((b, i) => [b, i % 5])), bf = tr.map(p => blockFold[cell(p)]);
    const eR = cv(rf), eB = cv(bf), eT = Math.sqrt(sum(te.map(p => (knn(tr, p[0], p[1]) - p[2]) ** 2)) / te.length);
    P.clear(); bg();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(P.X(0.7 * 1.68), P.Y(1), P.X(1.68) - P.X(0.7 * 1.68), P.Y(0) - P.Y(1));
    const folds = scheme.v === 'random CV' ? rf : bf;
    tr.forEach(([x, y], i) => { P.dot(x * 1.68, y, 4.5, '#fff'); P.dot(x * 1.68, y, 3.5, PAL[folds[i]]); });
    te.forEach(([x, y]) => P.dot(x * 1.68, y, 1.8, '#444'));
    P.text('training region (colors = folds)', 0.02, 0.97, C.ink, 'left', 0, 10); P.text('new region (test)', 0.72 * 1.68, 0.97, C.ink, 'left', 0, 10);
    o.innerHTML = `RMSE estimates: random CV = <b>${f2(eR)}</b>, block CV = <b>${f2(eB)}</b> &nbsp; real error in the new region = <b>${f2(eT)}</b>`;
  };
};

/* ---------- Part X: architectures ---------- */
// Link to a topic by id, with the section number the page assigned to it.
const topicRef = id => { const n = document.querySelector('#' + id + ' .num'); return `<a class="ref" href="#${id}">${n ? n.textContent : '?'}</a>`; };
const andList = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

V.archmap = box => {
  const ALG = [['conv', 'convolution'], ['convshape', 'pooling and stride'], ['batchnorm', 'normalization'], ['residual', 'residual connections'], ['mlp', 'dense (MLP) layers'], ['rnn', 'recurrence'], ['lstm', 'gating'], ['attention', 'attention'], ['posenc', 'positional encoding'], ['contrastive', 'contrastive loss'], ['gnn', 'message passing']];
  const ARCH = [
    ['LSTM', 1997, 'lstm', 'rnn lstm'], ['LeNet-5', 1998, 'lenet', 'conv convshape mlp'], ['VGG-16', 2014, 'lenet', 'conv convshape mlp'],
    ['seq2seq + attention', 2014, 'seq2seq', 'rnn lstm attention'], ['ResNet', 2015, 'resnet', 'conv convshape batchnorm residual'],
    ['U-Net', 2015, 'unet', 'conv convshape'], ['YOLO', 2016, 'yolo', 'conv convshape batchnorm mlp'], ['WaveNet', 2016, 'wavenet', 'conv lstm residual'],
    ['Transformer', 2017, 'encdec', 'attention posenc residual batchnorm mlp'], ['GCN', 2017, 'gnn', 'gnn mlp'],
    ['GPT', 2018, 'transformer', 'attention posenc residual batchnorm mlp'], ['BERT', 2018, 'bert', 'attention posenc residual batchnorm mlp'],
    ['ViT', 2020, 'vit', 'conv attention posenc residual batchnorm mlp'], ['CLIP', 2021, 'contrastive', 'attention contrastive residual batchnorm mlp'],
    ['Switch (MoE)', 2021, 'moe', 'attention residual batchnorm mlp'], ['Llama', 2023, 'llama', 'attention posenc residual batchnorm mlp lstm'],
    ['Mamba', 2023, 'mamba', 'rnn lstm conv residual batchnorm'], ['LLaVA', 2023, 'llava', 'attention contrastive posenc residual batchnorm mlp'],
  ].map(([n, y, id, a]) => ({ n, y, id, a: a.split(' ') }));
  const c = canvas(box, 600, 440), { ctx } = c;
  const yr = slider(row(box), 'show architectures up to the year', 1997, 2023, 1, 2023);
  const o = out(box);
  const yA = i => 24 + i * 396 / (ALG.length - 1), yR = j => 24 + j * 396 / (ARCH.length - 1);
  let sel = ['arch', 8];
  c.cv.addEventListener('click', e => {
    const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 440 / b.height;
    const near = (n, f) => range(n).reduce((a, i) => (Math.abs(f(i) - y) < Math.abs(f(a) - y) ? i : a), 0);
    sel = x < 300 ? ['alg', near(ALG.length, yA)] : ['arch', near(ARCH.length, yR)];
    closestBox(c.cv).draw();
  });
  return () => {
    const on = j => ARCH[j].y <= yr.v, alg = sel[0] === 'alg' ? ALG[sel[1]][0] : null, hotA = new Set(), hotR = new Set(), hc = alg ? C.orange : C.blue;
    if (alg) { hotA.add(alg); ARCH.forEach((r, j) => on(j) && r.a.includes(alg) && hotR.add(j)); }
    else if (on(sel[1])) { hotR.add(sel[1]); ARCH[sel[1]].a.forEach(a => hotA.add(a)); }
    ctx.clearRect(0, 0, 600, 440);
    const edge = (i, j, hot) => { ctx.strokeStyle = hot ? hc : '#e4e4e4'; ctx.lineWidth = hot ? 2 : 1; ctx.beginPath(); ctx.moveTo(172, yA(i)); ctx.bezierCurveTo(290, yA(i), 290, yR(j), 408, yR(j)); ctx.stroke(); };
    [false, true].forEach(pass => ARCH.forEach((r, j) => on(j) && r.a.forEach(a => { const hot = hotR.has(j) && hotA.has(a); if (hot === pass) edge(ALG.findIndex(q => q[0] === a), j, hot); })));
    const node = (x, y, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); };
    ctx.font = '14px Times New Roman';
    ALG.forEach(([id, t], i) => { const hot = hotA.has(id); node(172, yA(i), hot ? hc : '#bbb'); ctx.fillStyle = hot ? C.ink : C.gray; ctx.textAlign = 'right'; ctx.fillText(t, 164, yA(i) + 5); });
    ARCH.forEach((r, j) => {
      const hot = hotR.has(j);
      node(408, yR(j), !on(j) ? '#eee' : hot ? hc : '#bbb');
      ctx.textAlign = 'left'; ctx.fillStyle = !on(j) ? '#ccc' : hot ? C.ink : C.gray; ctx.fillText(r.n, 416, yR(j) + 5);
      ctx.font = '12px Times New Roman'; ctx.fillStyle = '#aaa'; ctx.fillText(r.y, 562, yR(j) + 5); ctx.font = '14px Times New Roman';
    });
    ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'right'; ctx.fillText('ALGORITHMS', 164, 10); ctx.textAlign = 'left'; ctx.fillText('ARCHITECTURES', 416, 10); ctx.font = FONT;
    if (alg) { const names = [...hotR].map(j => ARCH[j].n); o.innerHTML = `<b>${ALG[sel[1]][1]}</b> (${topicRef(alg)}) appears in ${names.length} of the ${ARCH.filter((_, j) => on(j)).length} architectures shown: ${andList(names)}.`; }
    else { const r = ARCH[sel[1]]; o.innerHTML = on(sel[1]) ? `<b>${r.n}</b> (${r.y}, topic ${topicRef(r.id)}) combines ${andList(r.a.map(a => `${ALG.find(q => q[0] === a)[1]} (${topicRef(a)})`))}.` : `${r.n} appeared in ${r.y}; move the slider to see it.`; }
  };
};

V.lenet = box => {
  const c = canvas(box, 600, 380), { ctx } = c;
  const r = row(box), net = select(r, 'network', ['LeNet-5', 'VGG-16'], 'VGG-16'), gap = check(r, 'global average pooling in place of the dense layers', false);
  const o = out(box);
  let hov = -1, rh = 16;
  hover(c, (x, y) => (hov = Math.floor((y - 28) / rh)));
  c.cv.addEventListener('pointerleave', () => { hov = -1; closestBox(c.cv).draw(); });
  const layers = () => {
    const le = net.v === 'LeNet-5', K = le ? 5 : 3, L = [];
    let H = le ? 32 : 224, Ci = le ? 1 : 3;
    (le ? [6, 'M', 16, 'M'] : [64, 64, 'M', 128, 128, 'M', 256, 256, 256, 'M', 512, 512, 512, 'M', 512, 512, 512, 'M']).forEach(v => {
      if (v === 'M') { H /= 2; L.push({ t: `max pool → ${H}×${H}×${Ci}`, p: 0, m: 0 }); return; }
      const Ho = le ? H - K + 1 : H;                                   // LeNet: no padding; VGG: padding 1 keeps the size
      L.push({ t: `conv ${K}×${K}, ${v} → ${Ho}×${Ho}×${v}`, p: K * K * Ci * v + v, m: Ho * Ho * K * K * Ci * v, pf: `${K}·${K}·${Ci}·${v} + ${v}`, mf: `${Ho}·${Ho}·${K}·${K}·${Ci}·${v}` });
      H = Ho; Ci = v;
    });
    if (gap.v) L.push({ t: `global average pool → ${Ci}`, p: 0, m: 0 });
    (gap.v ? [[Ci, le ? 10 : 1000]] : le ? [[H * H * Ci, 120], [120, 84], [84, 10]] : [[H * H * Ci, 4096], [4096, 4096], [4096, 1000]])
      .forEach(([a, b]) => L.push({ t: `dense ${a.toLocaleString()} → ${b.toLocaleString()}`, p: a * b + b, m: a * b, pf: `${a}·${b} + ${b}`, mf: `${a}·${b}`, dense: true }));
    return L;
  };
  return () => {
    const L = layers(), P = sum(L.map(l => l.p)), M = sum(L.map(l => l.m)), D = L.filter(l => l.dense), Pd = sum(D.map(l => l.p)), Md = sum(D.map(l => l.m));
    rh = Math.min(30, 344 / L.length);
    ctx.clearRect(0, 0, 600, 380); ctx.textAlign = 'left';
    ctx.font = '13px Times New Roman'; ctx.fillStyle = C.gray;
    ctx.fillText('layer → output shape', 6, 16); ctx.fillText('share of the parameters', 214, 16); ctx.fillText('share of the multiply-adds', 410, 16);
    ctx.font = `${Math.min(14, rh - 3)}px Times New Roman`;
    L.forEach((l, i) => {
      const y = 28 + i * rh;
      if (i === hov) { ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(0, y, 600, rh); }
      ctx.fillStyle = l.p ? C.ink : C.gray; ctx.fillText(l.t, 6, y + rh * 0.72);
      [[l.p / P, 214, 'rgba(31,95,191,.65)'], [l.m / M, 410, 'rgba(212,128,15,.7)']].forEach(([s, x0, col]) => {
        if (!s) return;
        const w = Math.max(1.5, 140 * s);
        ctx.fillStyle = col; ctx.fillRect(x0, y + 2, w, rh - 4);
        ctx.fillStyle = C.ink; ctx.fillText(pct(s), x0 + w + 4, y + rh * 0.72);
      });
    });
    ctx.font = FONT;
    const l = L[hov];
    o.innerHTML = l && l.p ? `${l.t}: ${l.pf} = <b>${l.p.toLocaleString()}</b> parameters; ${l.mf} = <b>${l.m.toLocaleString()}</b> multiply-adds`
      : `${net.v}: <b>${P.toLocaleString()}</b> parameters (${pct(Pd / P)} in the dense layers) and <b>${big(M)}</b> multiply-adds (${pct(1 - Md / M)} in the conv layers). Hover a row to see its formula.`;
  };
};

const RESNET = { 18: [false, [2, 2, 2, 2]], 34: [false, [3, 4, 6, 3]], 50: [true, [3, 4, 6, 3]], 101: [true, [3, 4, 23, 3]], 152: [true, [3, 8, 36, 3]] };
// The blocks of a torchvision ResNet at 224 × 224: shapes, parameters (BatchNorm included) and multiply-adds.
function resnetBlocks(depth) {
  const [bott, reps] = RESNET[depth], e = bott ? 4 : 1, B = [];
  let cin = 64, H = 56;
  reps.forEach((n, s) => {
    const w = 64 << s;
    for (let i = 0; i < n; i++) {
      const st = i === 0 && s > 0 ? 2 : 1, Ho = H / st, cout = w * e, proj = st > 1 || cin !== cout;
      let p = bott ? cin * w + 9 * w * w + w * cout + 4 * w + 2 * cout : 9 * cin * w + 9 * w * w + 4 * w;
      let m = bott ? H * H * cin * w + Ho * Ho * (9 * w * w + w * cout) : Ho * Ho * (9 * cin * w + 9 * w * w);
      if (proj) { p += cin * cout + 2 * cout; m += Ho * Ho * cin * cout; }
      B.push({ s, i, n, cin, cout, H, Ho, st, proj, p, m });
      cin = cout; H = Ho;
    }
  });
  return B;
}
const resnetTotals = depth => { const e = RESNET[depth][0] ? 4 : 1, B = resnetBlocks(depth); return [9536 + sum(B.map(b => b.p)) + 512 * e * 1000 + 1000, 118013952 + sum(B.map(b => b.m)) + 512 * e * 1000]; };

V.resnet = box => {
  const c = canvas(box, 600, 330), { ctx } = c;
  const dep = select(row(box), 'depth', ['18', '34', '50', '101', '152'], '50');
  const o = out(box);
  let hx = -1, hy = -1;
  hover(c, (x, y) => { hx = x; hy = y; });
  c.cv.addEventListener('pointerleave', () => { hx = -1; closestBox(c.cv).draw(); });
  const CX = [150, 252, 354, 456];
  const rect = (x, y, w, h, fill, t, sub) => {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = C.ink; ctx.fillText(t, x + w / 2, y + h / 2 + (sub ? -3 : 5));
    if (sub) { ctx.fillStyle = C.gray; ctx.fillText(sub, x + w / 2, y + h / 2 + 13); }
  };
  return () => {
    const d = +dep.v, [bott, reps] = RESNET[d], e = bott ? 4 : 1, B = resnetBlocks(d), [P, M] = resnetTotals(d), bh = Math.min(24, 190 / Math.max(...reps));
    ctx.clearRect(0, 0, 600, 330); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    rect(8, 110, 82, 60, '#eee', 'stem', '7×7 conv, pool');
    rect(516, 110, 78, 60, '#eee', 'head', 'pool, dense');
    let hit = null;
    B.forEach(b => {
      const x = CX[b.s] - 40, y = 140 - reps[b.s] * bh / 2 + b.i * bh, on = hx >= x && hx <= x + 80 && hy >= y && hy < y + bh;
      if (on) hit = b;
      ctx.fillStyle = on ? 'rgba(212,128,15,.6)' : b.proj ? 'rgba(212,128,15,.25)' : 'rgba(31,95,191,.22)';
      ctx.fillRect(x, y, 80, bh - 1);
    });
    reps.forEach((n, s) => {
      ctx.fillStyle = C.ink; ctx.fillText(`stage ${s + 1}`, CX[s], 20);
      ctx.fillStyle = C.gray; ctx.fillText(`${n} block${n > 1 ? 's' : ''}`, CX[s], 36); ctx.fillText(`${56 >> s}×${56 >> s}×${(64 << s) * e}`, CX[s], 256);
    });
    [[90, 108], [191, 210], [293, 312], [395, 414], [497, 514]].forEach(([a, b]) => parrow(ctx, a, 140, b, 140, C.gray));
    const seq = bott ? ['1×1, 64', '3×3, 64', '1×1, 256'] : ['3×3, 64', '3×3, 64'], bx = i => 150 + i * 104, px = bx(seq.length) + 2;
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(bott ? 'bottleneck block,' : 'basic block,', 8, 298); ctx.fillText('stage 1:', 8, 314);
    ctx.textAlign = 'center';
    seq.forEach((t, i) => { rect(bx(i), 292, 86, 24, 'rgba(31,95,191,.12)', t); parrow(ctx, bx(i) - 16, 304, bx(i), 304, C.gray); });
    parrow(ctx, bx(seq.length) - 18, 304, px - 9, 304, C.gray);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px, 304, 8, 0, 7); ctx.stroke(); ctx.fillStyle = C.ink; ctx.fillText('+', px, 308);
    ctx.strokeStyle = C.green; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx(0) - 22, 304); ctx.lineTo(bx(0) - 22, 280); ctx.lineTo(px, 280); ctx.lineTo(px, 296); ctx.stroke();
    ctx.fillStyle = C.green; ctx.fillText('shortcut', (bx(0) + px) / 2, 276); ctx.font = FONT;
    o.innerHTML = hit ? `stage ${hit.s + 1}, block ${hit.i + 1} of ${hit.n}: ${hit.H}×${hit.H}×${hit.cin} → ${hit.Ho}×${hit.Ho}×${hit.cout}${hit.st > 1 ? ', stride 2' : ''}, ${hit.proj ? 'projection' : 'identity'} shortcut; ${hit.p.toLocaleString()} parameters, ${big(hit.m)} multiply-adds`
      : `ResNet-${d}: 1 + ${sum(reps)} × ${bott ? 3 : 2} + 1 = ${d} weighted layers, <b>${f2(P / 1e6)} M</b> parameters, <b>${f2(M / 1e9)} G</b> multiply-adds per 224 × 224 image (VGG-16: 16 layers, 138.4 M and 15.5 G). Hover a block to see its shapes.`;
  };
};

V.unet = box => {
  const N = 64, IMG = range(N).map(y => range(N).map(x => {
    let g = 0.12 + 0.25 * x / N;                                                        // background stays below 0.5
    if ((x - 19) ** 2 + (y - 20) ** 2 < 110) g = 0.85;                                  // a large disk
    if (x > 8 && x < 27 && y > 42 && y < 56) g = 0.8;                                   // a rectangle
    if (x > 32 && x < 60 && Math.abs(y - 0.55 * x - 18) < 0.9) g = 0.9;                // a thin line
    if ([[44, 9], [52, 15], [58, 7], [41, 22]].some(([a, b]) => Math.abs(x - a) <= 1 && Math.abs(y - b) <= 1)) g = 0.9;   // small dots
    return g;
  }));
  const down = G => range(G.length / 2).map(y => range(G.length / 2).map(x => (G[2 * y][2 * x] + G[2 * y + 1][2 * x] + G[2 * y][2 * x + 1] + G[2 * y + 1][2 * x + 1]) / 4));
  const up = G => range(G.length * 2).map(y => range(G.length * 2).map(x => G[y >> 1][x >> 1]));
  const PYR = [IMG]; for (let l = 0; l < 4; l++) PYR.push(down(PYR[l]));
  const DET = range(4).map(l => { const U = up(PYR[l + 1]); return PYR[l].map((rw, y) => rw.map((v, x) => v - U[y][x])); });   // detail lost at each pooling
  const c = canvas(box, 600, 310), { ctx } = c;
  const D = slider(row(box), 'depth (number of poolings)', 1, 4, 1, 3);
  const r2 = row(box), sk = [64, 32, 16, 8].map(s => check(r2, `skip at ${s}×${s}`, true));
  const o = out(box);
  const img = (G, x0, y0, s, f) => G.forEach((rw, y) => rw.forEach((v, x) => { ctx.fillStyle = f ? f(v, x, y) : grayStyle(v); ctx.fillRect(x0 + x * s, y0 + y * s, s + 0.4, s + 0.4); }));
  return () => {
    const d = D.v;
    sk.forEach((s, l) => (s.i.disabled = l >= d));
    let R = PYR[d];
    for (let l = d - 1; l >= 0; l--) { const U = up(R); R = sk[l].v ? U.map((rw, y) => rw.map((v, x) => v + DET[l][y][x])) : U; }
    let TP = 0, FP = 0, FN = 0;
    const cmp = R.map((rw, y) => rw.map((v, x) => { const p = v > 0.5, g = IMG[y][x] > 0.5; p && g ? TP++ : p ? FP++ : g ? FN++ : 0; return p && g ? 1 : p ? 2 : g ? 3 : 0; }));
    const dice = 2 * TP / (2 * TP + FP + FN);
    ctx.clearRect(0, 0, 600, 310); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    const yl = l => 28 + l * 62, node = (x, y, t, on) => { ctx.fillStyle = on ? 'rgba(31,95,191,.15)' : '#f2f2f2'; ctx.fillRect(x - 28, y - 13, 56, 26); ctx.strokeStyle = '#999'; ctx.strokeRect(x - 28, y - 13, 56, 26); ctx.fillStyle = C.ink; ctx.fillText(t, x, y + 5); };
    const bs = 64 >> d, bw = Math.min(56, bs * 7), yb = yl(d) + 4;
    for (let l = 0; l < d; l++) {
      const s = 64 >> l, y = yl(l), live = sk[l].v;
      ctx.strokeStyle = live ? C.green : '#bbb'; ctx.lineWidth = live ? 2 : 1; ctx.setLineDash(live ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(68, y); ctx.lineTo(176, y); ctx.stroke(); ctx.setLineDash([]);
      if (live) parrow(ctx, 160, y, 178, y, C.green, 2);
      node(40, y, `${s}×${s}`, true); node(206, y, `${s}×${s}`, true);
      if (l + 1 < d) { parrow(ctx, 40, y + 14, 40, yl(l + 1) - 14, C.gray); parrow(ctx, 206, yl(l + 1) - 14, 206, y + 14, C.gray); }
      else { parrow(ctx, 40, y + 14, 119 - bw / 2, yb, C.gray); parrow(ctx, 127 + bw / 2, yb, 206, y + 14, C.gray); }
    }
    img(PYR[d], 123 - bw / 2, yb - bw / 2, bw / bs); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(123 - bw / 2, yb - bw / 2, bw, bw);
    ctx.fillStyle = C.gray; ctx.fillText('encoder', 40, 12); ctx.fillText('decoder', 206, 12); ctx.fillText(`bottom: ${bs}×${bs}`, 123, Math.min(306, yb + bw / 2 + 16));
    const COLS = ['#f3f3f3', 'rgba(46,139,87,.8)', 'rgba(212,128,15,.7)', 'rgba(192,57,43,.7)'];
    [['input', 270, IMG], ['decoder output', 382, R], ['mask vs truth', 494, cmp]].forEach(([t, x0, G], i) => { ctx.fillStyle = C.ink; ctx.fillText(t, x0 + 48, 18); img(G, x0, 26, 1.5, i === 2 ? v => COLS[v] : null); });
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = FONT; ctx.fillText(`Dice = ${f2(dice)}`, 270, 160);
    ctx.fillStyle = '#eee'; ctx.fillRect(270, 168, 320, 20); ctx.fillStyle = C.blue; ctx.fillRect(270, 168, 320 * dice, 20);
    ctx.font = '13px Times New Roman'; ctx.fillStyle = C.gray;
    ['green: correct, orange: false positive, red: missed', 'Turn off the fine skips: the thin line and the dots go first.'].forEach((t, i) => ctx.fillText(t, 270, 212 + i * 20));
    ctx.font = FONT;
    o.innerHTML = `each cell at the bottom of the U summarizes ${2 ** d}×${2 ** d} input pixels; skip connections on: ${andList(range(d).filter(l => sk[l].v).map(l => `${64 >> l}×${64 >> l}`)) || 'none'}; Dice = <b>${f2(dice)}</b>`;
  };
};

V.yolo = box => {
  const OBJ = [['car', 6, 0.27, 0.72, 0.38, 0.24, C.blue], ['person', 14, 0.6, 0.55, 0.12, 0.44, C.red], ['dog', 11, 0.82, 0.8, 0.22, 0.15, C.green], ['bicycle', 1, 0.42, 0.82, 0.16, 0.15, C.purple], ['bird', 2, 0.64, 0.16, 0.07, 0.05, C.orange], ['bird', 2, 0.69, 0.2, 0.07, 0.05, C.orange]];
  const c = canvas(box, 600, 320), { ctx } = c, Z = 300, X0 = 10, Y0 = 10, PX = 326;
  const r = row(box), S = slider(r, 'grid S', 2, 15, 1, 7), B = slider(r, 'boxes per cell B', 1, 3, 1, 2);
  const o = out(box);
  let ci = 3, cj = 4;
  c.cv.addEventListener('click', e => {
    const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width - X0, y = (e.clientY - b.top) * 320 / b.height - Y0;
    if (x >= 0 && x < Z && y >= 0 && y < Z) { cj = Math.floor(x / Z * S.v); ci = Math.floor(y / Z * S.v); closestBox(c.cv).draw(); }
  });
  const rgba = (h, a) => `rgba(${hexRGB(h).join(',')},${a})`;
  return () => {
    const s = S.v, nb = B.v, cell = Z / s, own = {};
    ci = Math.min(ci, s - 1); cj = Math.min(cj, s - 1);
    OBJ.forEach(q => { const k = Math.floor(q[3] * s) + ',' + Math.floor(q[2] * s); (own[k] = own[k] || []).push(q); });
    ctx.clearRect(0, 0, 600, 320);
    ctx.fillStyle = '#eef3fa'; ctx.fillRect(X0, Y0, Z, Z * 0.6); ctx.fillStyle = '#eef5ea'; ctx.fillRect(X0, Y0 + Z * 0.6, Z, Z * 0.4);
    Object.entries(own).forEach(([k, qs]) => { const [i, j] = k.split(',').map(Number); ctx.fillStyle = qs.length > 1 ? 'rgba(192,57,43,.4)' : rgba(qs[0][6], 0.25); ctx.fillRect(X0 + j * cell, Y0 + i * cell, cell, cell); });
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
    for (let k = 0; k <= s; k++) { ctx.beginPath(); ctx.moveTo(X0 + k * cell, Y0); ctx.lineTo(X0 + k * cell, Y0 + Z); ctx.moveTo(X0, Y0 + k * cell); ctx.lineTo(X0 + Z, Y0 + k * cell); ctx.stroke(); }
    ctx.font = '12px Times New Roman'; ctx.textAlign = 'left';
    OBJ.forEach(([n, , cx, cy, w, h, col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(X0 + (cx - w / 2) * Z, Y0 + (cy - h / 2) * Z, w * Z, h * Z);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X0 + cx * Z, Y0 + cy * Z, 3.5, 0, 7); ctx.fill();
      if (n !== 'bird' || cx < 0.66) ctx.fillText(n, X0 + (cx - w / 2) * Z + 2, Y0 + (cy - h / 2) * Z - 4);
    });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.strokeRect(X0 + cj * cell, Y0 + ci * cell, cell, cell);
    const qs = own[ci + ',' + cj] || [], q = qs[0], L = 5 * nb + 20;
    ctx.font = FONT; ctx.fillStyle = C.ink;
    ctx.fillText(`selected cell: row ${ci + 1}, column ${cj + 1}`, PX, 28);
    ctx.font = '13px Times New Roman';
    const lines = range(nb).map(k => (q && k === 0 ? `box 1: x=${f2(+(q[2] * s - cj).toFixed(2))} y=${f2(+(q[3] * s - ci).toFixed(2))} w=${q[4]} h=${q[5]} c=1` : `box ${k + 1}: c=0` + (q ? ' (a second guess, not responsible)' : '')));
    lines.push(q ? `class: ${q[0]} = 1, the other 19 classes = 0` : 'no object center here: the loss uses c alone');
    if (qs.length > 1) lines.push(`also centered here: ${qs.slice(1).map(z => z[0]).join(', ')}. YOLOv1 drops it.`);
    lines.forEach((t, i) => { ctx.fillStyle = qs.length > 1 && i === lines.length - 1 ? C.red : C.ink; ctx.fillText(t, PX, 56 + i * 22); });
    const sw = Math.min(7, 262 / L), y0 = 80 + lines.length * 22;
    ctx.fillStyle = C.gray; ctx.fillText(`the cell's ${L} output numbers:`, PX, y0);
    for (let m = 0; m < L; m++) {
      const isBox = m < 5 * nb, isC = isBox && m % 5 === 4, val = isBox ? q && m < 5 : q && m - 5 * nb === q[1];
      ctx.fillStyle = isBox ? rgba(isC ? C.green : C.blue, val ? 0.75 : 0.13) : rgba(C.orange, val ? 0.85 : 0.15);
      ctx.fillRect(PX + m * sw, y0 + 8, sw - 1, 22);
    }
    ctx.fillStyle = C.gray; ctx.fillText(`${nb} × (x, y, w, h, c)`, PX, y0 + 46); ctx.textAlign = 'right'; ctx.fillText('20 classes', PX + L * sw, y0 + 46); ctx.textAlign = 'left';
    ctx.font = FONT;
    const clash = Object.values(own).filter(v => v.length > 1).length;
    o.innerHTML = `output tensor S × S × (5B + C) = ${s} × ${s} × ${L} = <b>${(s * s * L).toLocaleString()}</b> numbers; cells holding two object centers: <b>${clash}</b>. Click a cell to see its target.`;
  };
};

V.wavenet = box => {
  const T = 32, c = canvas(box, 600, 300), { ctx } = c;
  const r = row(box), L = slider(r, 'layers', 1, 5, 1, 4), K = select(r, 'kernel size', ['2', '3'], '2'), dil = select(r, 'dilation', ['doubling', 'none'], 'doubling');
  const o = out(box);
  let sel = T - 1;
  const X = t => 60 + t * 530 / (T - 1);
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width; sel = Math.max(0, Math.min(T - 1, Math.round((x - 60) * (T - 1) / 530))); closestBox(c.cv).draw(); });
  return () => {
    const nl = L.v, k = +K.v, ds = range(nl).map(l => (dil.v === 'doubling' ? 2 ** l : 1)), Y = l => 276 - l * 248 / nl;
    const hot = range(nl + 1).map(() => new Set()); hot[nl].add(sel);
    for (let l = nl; l > 0; l--) hot[l].forEach(t => { for (let m = 0; m < k; m++) if (t - m * ds[l - 1] >= 0) hot[l - 1].add(t - m * ds[l - 1]); });
    ctx.clearRect(0, 0, 600, 300);
    [false, true].forEach(pass => { for (let l = 1; l <= nl; l++) for (let t = 0; t < T; t++) for (let m = 0; m < k; m++) {
      const u = t - m * ds[l - 1], h = hot[l].has(t);
      if (u < 0 || h !== pass) continue;
      ctx.strokeStyle = h ? C.orange : '#e3e3e3'; ctx.lineWidth = h ? 1.8 : 1; ctx.beginPath(); ctx.moveTo(X(t), Y(l)); ctx.lineTo(X(u), Y(l - 1)); ctx.stroke();
    } });
    for (let l = 0; l <= nl; l++) for (let t = 0; t < T; t++) { ctx.beginPath(); ctx.arc(X(t), Y(l), l === nl && t === sel ? 6 : 3.5, 0, 7); ctx.fillStyle = hot[l].has(t) ? (l ? C.orange : C.red) : '#cdcdcd'; ctx.fill(); }
    ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'left';
    for (let l = 1; l <= nl; l++) ctx.fillText(`D = ${ds[l - 1]}`, 4, Y(l) + 4);
    ctx.fillText('input', 4, Y(0) + 4); ctx.textAlign = 'center'; ctx.fillText('time →', 325, 297); ctx.font = FONT;
    const R = 1 + (k - 1) * sum(ds);
    o.innerHTML = `receptive field R = 1 + (K − 1)(${ds.join(' + ')}) = <b>${R}</b> steps` + (R > sel + 1 ? ` (the figure starts at t = 0 and shows ${hot[0].size} of them)` : '') + `; weights per channel pair: K · L = ${k * nl}. Click a top node to pick another output.`;
  };
};

V.encdec = box => {
  const SRC = ['the', 'black', 'cat', 'sleeps'], TGT = ['<s>', 'le', 'chat', 'noir', 'dort'], ALL = ['the', 'black', 'cat', 'sleeps', '→', 'le', 'chat', 'noir', 'dort'];
  const c = canvas(box, 600, 330), { ctx } = c;
  const arch = select(row(box), 'architecture', ['encoder-decoder (T5)', 'decoder-only (GPT)', 'encoder-only (BERT)', 'prefix LM'], 'encoder-decoder (T5)');
  const o = out(box);
  let sel = { m: 1, i: 2 }, mats = [];
  const specs = () => {
    const a = arch.v, all = () => true, causal = (i, j) => j <= i;
    if (a.startsWith('encoder-decoder')) return [{ t: 'encoder self-attention', q: SRC, k: SRC, ok: all, x: 70 }, { t: 'decoder self-attention', q: TGT, k: TGT, ok: causal, x: 250 }, { t: 'cross-attention', q: TGT, k: SRC, ok: all, x: 448 }];
    if (a.startsWith('decoder')) return [{ t: 'causal self-attention: prompt and answer in one stack', q: ALL, k: ALL, ok: causal, x: 200 }];
    if (a.startsWith('encoder-only')) return [{ t: 'bidirectional self-attention', q: SRC, k: SRC, ok: all, x: 250 }];
    return [{ t: 'full attention inside the prompt, causal after it', q: ALL, k: ALL, ok: (i, j) => j <= i || j < 5, x: 200 }];
  };
  c.cv.addEventListener('click', e => {
    const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 330 / b.height;
    mats.forEach((m, mi) => { const i = Math.floor((y - 92) / m.cs); if (x > m.x - 50 && x < m.x + m.k.length * m.cs && i >= 0 && i < m.q.length) sel = { m: mi, i }; });
    closestBox(c.cv).draw();
  });
  return () => {
    mats = specs(); const cs = mats.length > 1 ? 28 : 24;
    if (sel.m >= mats.length || sel.i >= mats[sel.m].q.length) sel = { m: mats.length - 1, i: Math.min(2, mats[mats.length - 1].q.length - 1) };
    const pair = mats.length > 1 && sel.m > 0;                            // decoder rows of self- and cross-attention share a query
    ctx.clearRect(0, 0, 600, 330);
    mats.forEach((m, mi) => {
      m.cs = cs;
      const hotRow = mi === sel.m || (pair && mi > 0);
      ctx.font = '13px Times New Roman'; ctx.textAlign = 'center'; ctx.fillStyle = C.ink; ctx.fillText(m.t, m.x + m.k.length * cs / 2, 18);
      ctx.font = '12px Times New Roman';
      m.k.forEach((t, j) => { ctx.save(); ctx.translate(m.x + j * cs + cs / 2 + 3, 86); ctx.rotate(-Math.PI / 3); ctx.textAlign = 'left'; ctx.fillStyle = C.gray; ctx.fillText(t, 0, 0); ctx.restore(); });
      m.q.forEach((t, i) => {
        const on = hotRow && i === sel.i;
        ctx.textAlign = 'right'; ctx.fillStyle = on ? C.orange : C.gray; ctx.fillText(t, m.x - 5, 92 + i * cs + cs / 2 + 4);
        m.k.forEach((_, j) => { ctx.fillStyle = m.ok(i, j) ? (on ? 'rgba(212,128,15,.75)' : 'rgba(31,95,191,.4)') : '#f1f1f1'; ctx.fillRect(m.x + j * cs, 92 + i * cs, cs - 2, cs - 2); });
      });
    });
    ctx.font = '13px Times New Roman'; ctx.textAlign = 'left'; ctx.fillStyle = C.gray;
    ctx.fillText('rows: queries (the token that reads); columns: keys (the tokens it can read). The mask hides the gray cells.', 10, 322); ctx.font = FONT;
    const esc = w => w.replace(/</g, '&lt;').replace(/>/g, '&gt;'), m = mats[sel.m], tok = esc(m.q[sel.i]), sees = mm => esc(mm.k.filter((_, j) => mm.ok(sel.i, j)).join(', '));
    o.innerHTML = pair ? `"<b>${tok}</b>" (decoder) reads ${sees(mats[1])} from its own output and ${sees(mats[2])} through cross-attention. Click a row to pick another token.`
      : `"<b>${tok}</b>" reads ${sees(m)}. Click a row to pick another token.`;
  };
};

V.llama = box => {
  const PRE = { 'Llama 2 7B': [32, 4096, 32, 32, 11008, 32000], 'Mistral 7B': [32, 4096, 32, 8, 14336, 32000], 'Llama 3 8B': [32, 4096, 32, 8, 14336, 128256], 'Llama 3 70B': [80, 8192, 64, 8, 28672, 128256] };
  const NS = [2048, 4096, 8192, 32768, 131072], c = canvas(box, 600, 290), { ctx } = c;
  let cfg = PRE['Llama 3 8B'], name = 'Llama 3 8B';
  const r = row(box); Object.keys(PRE).forEach(k => button(r, k, () => { cfg = PRE[k]; name = k; g.v = Math.log2(cfg[3]); }));
  const r2 = row(box), g = slider(r2, 'key-value heads g', 0, 6, 1, 3, i => Math.min(cfg[2], 2 ** i));
  const n = slider(r2, 'context n', 0, 4, 1, 2, i => NS[i].toLocaleString()), bs = slider(r2, 'sequences served at once', 1, 64, 1, 8);
  const o = out(box);
  const gib = b => f2(b / 2 ** 30) + ' GiB';
  return () => {
    const [L, d, h, g0, ff, V0] = cfg, dh = d / h, G = Math.min(h, 2 ** g.v), N0 = NS[n.v];
    const params = 2 * V0 * d + L * (2 * d * d + 2 * d * G * dh + 3 * d * ff + 2 * d) + d, perTok = 2 * L * G * dh * 2, kv = perTok * N0 * bs.v, wts = 2 * params;
    ctx.clearRect(0, 0, 600, 290); ctx.font = '13px Times New Roman'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink;
    ctx.fillText(`${h} query heads`, 20, 16); ctx.fillText(`${G} key-value head${G > 1 ? 's' : ''}: each serves ${h / G} query head${h / G > 1 ? 's' : ''}`, 20, 172);
    const qw = 560 / h, kw = 560 / G, col = j => PAL[j % 5];
    for (let i = 0; i < h; i++) {
      const j = Math.floor(i / (h / G));
      ctx.strokeStyle = col(j); ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(20 + (i + 0.5) * qw, 44); ctx.lineTo(20 + (j + 0.5) * kw, 132); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = col(j); ctx.fillRect(20 + i * qw + 0.5, 24, Math.max(1, qw - 1.5), 20);
    }
    for (let j = 0; j < G; j++) { ctx.fillStyle = col(j); ctx.fillRect(20 + j * kw + 1, 132, Math.max(1.5, kw - 2), 22); }
    if (G <= 16) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; for (let j = 0; j < G; j++) ctx.fillText('K V', 20 + (j + 0.5) * kw, 148); }
    const mx = Math.max(kv, wts), bar = (y, v, t, cl) => { ctx.fillStyle = cl; ctx.fillRect(170, y, 410 * v / mx, 24); ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(t, 162, y + 17); ctx.textAlign = 'left'; ctx.fillText(gib(v), 176 + 410 * v / mx > 520 ? 176 : 176 + 410 * v / mx, y + 17); };
    bar(196, wts, `weights (${name})`, 'rgba(120,120,120,.45)');
    bar(234, kv, `KV cache, ${bs.v} × ${N0.toLocaleString()} tokens`, 'rgba(212,128,15,.65)');
    ctx.fillStyle = C.gray; ctx.textAlign = 'left'; ctx.fillText('memory in 16-bit numbers', 170, 284); ctx.font = FONT;
    o.innerHTML = `KV cache per token: 2 · ${L} · ${G} · ${dh} · 2 bytes = <b>${f2(perTok / 1024)} KiB</b>; for ${bs.v} sequences of ${N0.toLocaleString()} tokens: <b>${gib(kv)}</b>` + (G < h ? ` (with g = h = ${h}: ${gib(kv * h / G)})` : ' (ordinary multi-head attention)') + `; ${f2(params / 1e9)} B parameters` + (G !== g0 ? ` (${name} uses g = ${g0})` : '');
  };
};

V.moe = box => {
  const q = rng(7), TOK = [];
  [[-1.6, 1.2, 26], [1.5, 1.3, 16], [1.2, -1.3, 12], [-1.3, -1.4, 10]].forEach(([a, b, n]) => { for (let i = 0; i < n; i++) TOK.push([a + 0.55 * gauss(q), b + 0.55 * gauss(q)]); });
  const COL = [C.blue, C.red, C.green, C.orange, C.purple, '#17a2b8', '#8c564b', '#d63384'], T = TOK.length;
  const c = canvas(box, 600, 320), { ctx } = c, P = { c, X: x => 150 + 44 * x, Y: y => 165 - 44 * y, ix: px => (px - 150) / 44, iy: py => (165 - py) / 44 };
  const r = row(box), E = slider(r, 'experts E', 2, 8, 1, 6), k = slider(r, 'experts per token k', 1, 3, 1, 2), cf = slider(r, 'capacity factor', 0.5, 2, 0.05, 1.25);
  const W = [], bias = [];
  let key = 0, run = false;
  const reset = () => {
    key = E.v;
    W.splice(0, W.length, ...range(E.v).map(i => ({ x: 1.3 * Math.cos(0.9 + i * 6.283 / E.v), y: 1.3 * Math.sin(0.9 + i * 6.283 / E.v) })));
    bias.splice(0, bias.length, ...range(E.v).map(() => 0));
  };
  reset();
  drag(P, W);
  const r2 = row(box); button(r2, 'Balance / pause', () => (run = !run)); button(r2, 'Reset', () => { run = false; reset(); });
  const o = out(box);
  const route = () => TOK.map(([x, y]) => {
    const s = W.map(w => 1.5 * (w.x * x + w.y * y)), p = soft(s);
    const top = range(E.v).sort((a, b) => s[b] + bias[b] - (s[a] + bias[a])).slice(0, k.v);   // the bias steers the choice only
    return { p, top };
  });
  loop(box, () => {
    if (!run || key !== E.v) return;
    const R = route(), load = range(E.v).map(i => R.filter(t => t.top.includes(i)).length), mean = T * k.v / E.v;
    load.forEach((l, i) => (bias[i] += 0.03 * Math.sign(mean - l)));   // raise underloaded experts, lower overloaded ones
    box.draw();
  });
  return () => {
    if (key !== E.v) reset();
    const R = route(), cap = Math.floor(cf.v * k.v * T / E.v), load = range(E.v).map(() => 0), dropped = new Set();
    R.forEach((t, ti) => t.top.forEach(i => { if (++load[i] > cap) dropped.add(ti); }));
    const f = load.map(l => l / (T * k.v)), Pm = range(E.v).map(i => sum(R.map(t => t.p[i])) / T), aux = E.v * sum(f.map((v, i) => v * Pm[i]));
    ctx.clearRect(0, 0, 600, 320);
    ctx.strokeStyle = '#eee'; ctx.beginPath(); ctx.moveTo(P.X(-3.2), P.Y(0)); ctx.lineTo(P.X(3.2), P.Y(0)); ctx.moveTo(P.X(0), P.Y(3.5)); ctx.lineTo(P.X(0), P.Y(-3.5)); ctx.stroke();
    TOK.forEach(([x, y], ti) => { ctx.beginPath(); ctx.arc(P.X(x), P.Y(y), 4, 0, 7); ctx.fillStyle = COL[R[ti].top[0]]; ctx.fill(); if (dropped.has(ti)) { ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke(); } });
    W.forEach((w, i) => { parrow(ctx, P.X(0), P.Y(0), P.X(w.x), P.Y(w.y), COL[i], 2.5); ctx.beginPath(); ctx.arc(P.X(w.x), P.Y(w.y), 6, 0, 7); ctx.strokeStyle = COL[i]; ctx.lineWidth = 2; ctx.stroke(); });
    const mx = Math.max(cap, ...load) * 1.1, bw = 250 / E.v, base = 260, sc = 220 / mx;
    ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    load.forEach((l, i) => {
      const x = 335 + i * bw;
      ctx.fillStyle = COL[i]; ctx.globalAlpha = 0.6; ctx.fillRect(x + 3, base - Math.min(l, cap) * sc, bw - 6, Math.min(l, cap) * sc); ctx.globalAlpha = 1;
      if (l > cap) { ctx.fillStyle = 'rgba(192,57,43,.85)'; ctx.fillRect(x + 3, base - l * sc, bw - 6, (l - cap) * sc); }
      ctx.fillStyle = C.ink; ctx.fillText(l, x + bw / 2, base - l * sc - 5); ctx.fillStyle = C.gray; ctx.fillText(`E${i + 1}`, x + bw / 2, base + 16);
    });
    ctx.strokeStyle = C.ink; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(332, base - cap * sc); ctx.lineTo(590, base - cap * sc); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(`capacity ${cap}`, 335, base - cap * sc - 6 > 14 ? base - cap * sc - 6 : 14);
    ctx.fillStyle = C.gray; ctx.fillText('tokens per expert (red: over capacity, dropped)', 335, 300);
    ctx.fillText('tokens, colored by first-choice expert', 10, 314); ctx.font = FONT;
    o.innerHTML = `${dropped.size} of ${T} tokens lose an expert to the capacity limit; busiest expert ${Math.max(...load)}, quietest ${Math.min(...load)} (fair share ${f2(T * k.v / E.v)}); balance loss E·Σ f·P = ${f2(aux)}; each token runs ${k.v} of ${E.v} expert FFNs. Drag the arrow tips to move the router.`;
  };
};

V.mamba = box => {
  const T = 80, SIG = { 8: 1, 30: -0.7, 55: 0.5 };
  const c1 = canvas(box, 600, 120), P1 = plot(c1, 0, T, -1.2, 1.2, 22), c2 = canvas(box, 600, 170), P2 = plot(c2, 0, T, -1.2, 1.2, 22), c3 = canvas(box, 600, 130), P3 = plot(c3, 0, 30, 0, 1, 22);
  const r = row(box), dl = slider(r, 'step Δ of the fixed SSM', 0.02, 2, 0.01, 0.3), sel = check(r, 'selective SSM (Mamba)', true);
  const r2 = row(box), nz = slider(r2, 'filler noise', 0, 0.6, 0.01, 0.25);
  let seed = 1; button(r2, 'New noise', () => seed++);
  const o = out(box);
  return () => {
    const q = rng(seed * 13), x = range(T).map(t => (t in SIG ? SIG[t] : nz.v * gauss(q)));
    const a = Math.exp(-dl.v), b = 1 - a;                              // A = -1, B = C = 1: Ā = e^{-Δ}, B̄ = 1 - e^{-Δ} (zero-order hold)
    let h = 0;
    const yRec = x.map(v => (h = a * h + b * v)), K = range(T).map(j => b * a ** j);
    const yConv = range(T).map(t => sum(range(t + 1).map(j => K[j] * x[t - j])));
    const gap = Math.max(...yRec.map((v, t) => Math.abs(v - yConv[t])));
    h = 0;
    const ySel = x.map((v, t) => { const A = Math.exp(-(t in SIG ? 4 : 0.002)); return (h = A * h + (1 - A) * v); });   // Δ_t: 4 on marked tokens, 0.002 elsewhere
    P1.clear(); P1.seg(0, 0, T, 0, '#bbb');
    x.forEach((v, t) => P1.seg(t, 0, t, v, t in SIG ? C.red : '#999', t in SIG ? 2.5 : 1.2));
    if (sel.v) Object.keys(SIG).forEach(t => P1.text('large Δ', +t, 1.05, C.red, 'center'));
    P1.text('input x_t: three marked tokens among filler', 1, -1.05, C.ink);
    P2.clear(); P2.seg(0, 0, T, 0, '#bbb');
    P2.path(yRec.map((v, t) => [t, v]), C.blue, 2);
    yConv.forEach((v, t) => t % 3 === 0 && P2.dot(t, v, 2.5, C.ink));
    if (sel.v) P2.path(ySel.map((v, t) => [t, v]), C.red, 2);
    P2.text('blue: fixed SSM by recurrence, dots: the same by convolution' + (sel.v ? ', red: selective SSM' : ''), 1, -1.05, C.ink);
    P3.clear(); P3.axes(false);
    K.slice(0, 31).forEach((v, j) => { P3.seg(j, 0, j, v, C.blue, 2); P3.dot(j, v, 2.5, C.blue); });
    P3.text('kernel K_j = C Ā^j B̄ of the fixed SSM', 12, 0.85, C.ink);
    o.innerHTML = `fixed SSM: K<sub>j</sub> = (1 − e<sup>−Δ</sup>) e<sup>−jΔ</sup>, memory half-life ln 2 / Δ = <b>${f2(Math.LN2 / dl.v)}</b> steps; recurrence and convolution differ by at most ${gap.toExponential(1)}` + (sel.v ? '. The selective SSM writes on the marked tokens and holds its state through the filler.' : '');
  };
};

V.llava = box => {
  const IM = 64, PIX = range(IM).map(y => range(IM).map(x => sceneRGB(x * 32 / IM, y * 20 / IM, 32, 20)));
  const c = canvas(box, 600, 300), { ctx } = c;
  const r = row(box), res = select(r, 'resolution', ['224', '336', '448', '672'], '336'), ps = select(r, 'patch', ['14', '16'], '14'), cx = select(r, 'context', ['2048', '4096', '8192', '32768'], '4096');
  const r2 = row(box), merge = check(r2, 'merge 2 × 2 patches into one token', false), tiles = check(r2, 'tiles: 2 × 2 grid plus an overview', false);
  const o = out(box);
  const rbox = (x, y, w, h, t, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.fillText(t, x + w / 2, y + h / 2 + 5); };
  return () => {
    const R = +res.v, p = +ps.v, side = R / p, per = merge.v ? Math.ceil(side / 2) ** 2 : side * side, N = per * (tiles.v ? 5 : 1), text = 120, CT = +cx.v;
    ctx.clearRect(0, 0, 600, 300); ctx.font = '13px Times New Roman';
    const S = 150, x0 = 12, y0 = 30, sc = S / IM;
    PIX.forEach((rw, y) => rw.forEach(([a, b, cc], x) => { ctx.fillStyle = `rgb(${a},${b},${cc})`; ctx.fillRect(x0 + x * sc, y0 + y * sc, sc + 0.3, sc + 0.3); }));
    const lines = (n, lw, col) => { ctx.strokeStyle = col; ctx.lineWidth = lw; for (let i = 0; i <= n; i++) { const t = i * S / n; ctx.beginPath(); ctx.moveTo(x0 + t, y0); ctx.lineTo(x0 + t, y0 + S); ctx.moveTo(x0, y0 + t); ctx.lineTo(x0 + S, y0 + t); ctx.stroke(); } };
    const g = (tiles.v ? 2 : 1) * side;
    lines(g, 0.5, 'rgba(255,255,255,.7)');
    if (merge.v) lines(Math.ceil(g / 2), 1.2, 'rgba(255,255,255,.95)');
    if (tiles.v) lines(2, 2.5, C.orange);
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.fillText(tiles.v ? `${2 * R} × ${2 * R} image, four ${R} × ${R} tiles` : `${R} × ${R} image`, x0, 20);
    if (tiles.v) { ctx.fillText('+ overview', x0 + S + 6, y0 + 12); }
    rbox(255, 70, 100, 44, 'ViT (CLIP)', 'rgba(31,95,191,.15)'); rbox(375, 70, 100, 44, 'projector', 'rgba(46,139,87,.18)'); rbox(495, 70, 92, 44, 'language model', 'rgba(212,128,15,.18)');
    parrow(ctx, 172, 92, 253, 92, C.gray); parrow(ctx, 355, 92, 373, 92, C.gray); parrow(ctx, 475, 92, 493, 92, C.gray);
    ctx.fillStyle = C.gray; ctx.textAlign = 'center'; ctx.fillText(`${N.toLocaleString()} vectors, d = 1,024`, 315, 134); ctx.fillText('→ d = 4,096', 425, 134);
    const W = 560, used = Math.min(1, N / CT), tw = Math.min(1 - used, text / CT);
    ctx.fillStyle = '#eee'; ctx.fillRect(20, 232, W, 30);
    ctx.fillStyle = 'rgba(212,128,15,.7)'; ctx.fillRect(20, 232, W * used, 30); ctx.fillStyle = 'rgba(31,95,191,.6)'; ctx.fillRect(20 + W * used, 232, W * tw, 30);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(`context window, ${CT.toLocaleString()} tokens: image (orange), a ${text}-token question (blue), free space (gray)`, 20, 222);
    if (N + text > CT) { ctx.fillStyle = C.red; ctx.fillText(`the image alone needs ${N.toLocaleString()} tokens: it does not fit`, 20, 284); }
    ctx.font = FONT;
    o.innerHTML = `image tokens = ${tiles.v ? '5 × ' : ''}(${R}/${p})²${merge.v ? ' / 4' : ''} = <b>${N.toLocaleString()}</b>, ${pct(N / CT)} of the context`;
  };
};

/* ---------- Number formats, scaling laws, flow matching and graphs ---------- */
// Symmetric absmax quantization with one scale per group (group = w.length gives one scale for all).
function quantize(w, bits, group) {
  const top = 2 ** (bits - 1) - 1, out = [];
  for (let g = 0; g < w.length; g += group) {
    const part = w.slice(g, g + group), s = Math.max(...part.map(Math.abs)) / top;
    part.forEach(x => out.push(s * Math.max(-top, Math.min(top, Math.round(x / s)))));
  }
  return out;
}

V.floats = box => {
  const q = rng(17), base = range(4096).map(() => 0.02 * gauss(q));
  const c = canvas(box, 600, 340), { ctx } = c;
  const r = row(box), bits = slider(r, 'bits', 2, 8, 1, 4), mode = select(r, 'scale', ['one for all weights', 'one per 32 weights'], 'one for all weights');
  const outl = check(row(box), 'one outlier weight (0.4)', true);
  const o = out(box);
  return () => {
    const w = base.slice(); if (outl.v) w[5] = 0.4;
    const grp = mode.v.includes('all') ? w.length : 32, b = bits.v, wq = quantize(w, b, grp), top = 2 ** (b - 1) - 1;
    const rmse = (bb, gg) => { const z = quantize(w, bb, gg); return Math.sqrt(sum(w.map((x, i) => (x - z[i]) ** 2)) / w.length); };
    const P = plot({ ctx, w: 600, h: 200 }, -1, 64, -1, 1, 24), ymax = Math.max(...w.slice(0, 64).map(Math.abs), ...(grp === 32 ? [] : [Math.max(...w.map(Math.abs))])) * 1.15;
    P.y0 = -ymax; P.y1 = ymax;
    ctx.clearRect(0, 0, 600, 340);
    [0, 32].forEach(g0 => {
      const span = grp === 32 ? w.slice(g0, g0 + 32) : w, s = Math.max(...span.map(Math.abs)) / top;
      for (let k = -top; k <= top; k++) if (Math.abs(k * s) <= ymax) P.seg(g0 - 0.5, k * s, g0 + 31.5, k * s, k ? 'rgba(31,95,191,.35)' : 'rgba(31,95,191,.6)', 1);
    });
    if (grp === 32) P.seg(31.5, -ymax, 31.5, ymax, '#bbb', 1, [4, 3]);
    for (let i = 0; i < 64; i++) { P.dot(i, w[i], 3, i === 5 && outl.v ? C.red : C.ink); ctx.strokeStyle = C.orange; ctx.lineWidth = 1.5; const X = P.X(i), Y = P.Y(wq[i]); ctx.beginPath(); ctx.moveTo(X - 3, Y - 3); ctx.lineTo(X + 3, Y + 3); ctx.moveTo(X + 3, Y - 3); ctx.lineTo(X - 3, Y + 3); ctx.stroke(); }
    ctx.font = '12px Times New Roman'; ctx.fillStyle = C.gray; ctx.textAlign = 'left'; ctx.fillText('first 64 weights: dots = true value, crosses = stored value, lines = the levels', 26, 14);
    const Q = plot({ ctx, w: 600, h: 140 }, 1.6, 8.4, -4.6, -1, 24);
    ctx.save(); ctx.translate(0, 200);
    Q.seg(2, -4.6, 8, -4.6, '#999'); for (let k = 2; k <= 8; k++) Q.text(k + ' bits', k, -4.6, C.gray, 'center', 0, 14);
    [[w.length, C.blue, 'one scale'], [32, C.green, 'scale per 32']].forEach(([gg, col, name]) => {
      const pts = range(7).map(i => [i + 2, Math.log10(rmse(i + 2, gg))]);
      Q.path(pts, col, 2); pts.forEach(([x, y]) => Q.dot(x, y, x === b ? 5 : 2.5, col));
      Q.text(name, 2, pts[0][1], col, 'left', 8, gg === 32 ? 16 : -8);
    });
    ctx.fillStyle = C.gray; ctx.textAlign = 'left'; ctx.fillText('error (RMSE, log scale) over all 4,096 weights', 26, 6);
    ctx.restore(); ctx.font = FONT;
    const gb = 7e9 * b / 8 / 1e9 + (grp === 32 ? 7e9 / 32 * 2 / 1e9 : 0);
    o.innerHTML = `${b}-bit, ${grp === 32 ? 'a scale per 32 weights' : 'one scale'}: RMSE = <b>${rmse(b, grp).toExponential(2)}</b> (weights have standard deviation 0.02); a 7-billion-parameter model would take <b>${f2(gb)} GB</b>`;
  };
};

V.scalinglaws = box => {
  const E = 1.8172, A = 482.01, B = 2085.43, al = 0.3478, be = 0.3658, L = (N, D) => E + A / N ** al + B / D ** be;
  const G = (al * A / (be * B)) ** (1 / (al + be)), opt = C => { const N = G * (C / 6) ** (be / (al + be)); return [N, C / (6 * N)]; };
  const MODELS = { 'Chinchilla 70B': [70e9, 1.4e12, 'right', -7, 16], 'Gopher 280B': [280e9, 300e9, 'left', 7, -6], 'Llama 3 8B': [8e9, 15e12, 'right', -7, -6] };
  const c = canvas(box, 600, 330), P = plot(c, 7, 12.6, 1.8, 3.8, 30), { ctx } = c;
  const r = row(box), lc = slider(r, 'compute budget, log₁₀ FLOPs', 18, 25, 0.1, 23.8, v => '10^' + v.toFixed(1));
  let pick = null;
  const r2 = row(box); Object.keys(MODELS).forEach(k => button(r2, k, () => { pick = k; const [n, d] = MODELS[k]; lc.v = Math.round(Math.log10(6 * n * d) * 10) / 10; }));
  const o = out(box);
  return () => {
    const C0 = 10 ** lc.v, iso = C => x => L(10 ** x, C / (6 * 10 ** x));
    P.clear(); P.axes();
    for (let e = 18; e <= 25; e++) P.fn(iso(10 ** e), '#ddd', 1.2);
    P.path(range(71).map(i => { const [n] = opt(10 ** (18 + i * 0.1)); return [Math.log10(n), L(...opt(10 ** (18 + i * 0.1)))]; }), C.orange, 1.5, false);
    P.fn(iso(C0), C.blue, 2.5);
    const [N, D] = opt(C0);
    P.dot(Math.log10(N), L(N, D), 6, C.orange);
    ctx.font = '12px Times New Roman';
    Object.entries(MODELS).forEach(([k, [n, d, al_, dx, dy]]) => { P.dot(Math.log10(n), L(n, d), k === pick ? 5 : 3.5, k === pick ? C.red : C.ink); P.text(k, Math.log10(n), L(n, d), k === pick ? C.red : C.gray, al_, dx, dy); });
    P.text('model size N, log₁₀ parameters', 12.6, 3.8, C.gray, 'right', -4, 12); P.text('test loss', 7, 3.8, C.gray, 'left', 4, 12); ctx.font = FONT;
    const words = x => (x >= 1e12 ? f2(x / 1e12) + ' trillion' : x >= 1e9 ? f2(x / 1e9) + ' billion' : f2(x / 1e6) + ' million');
    let txt = `budget 10<sup>${lc.v.toFixed(1)}</sup> FLOPs: best model <b>${words(N)}</b> parameters on <b>${words(D)}</b> tokens (${Math.round(D / N)} tokens per parameter), loss ${f2(L(N, D))}`;
    if (pick) { const [n, d] = MODELS[pick]; txt += `. ${pick} on ${words(d)} tokens: loss ${f2(L(n, d))}, ${Math.round(d / n)} tokens per parameter`; }
    o.innerHTML = txt;
  };
};

V.flowmatch = box => {
  const q = rng(23), data = range(200).map(i => { const t = Math.PI * q(); return i % 2 ? [Math.cos(t) - 0.5, Math.sin(t) - 0.25] : [0.5 - Math.cos(t), 0.25 - Math.sin(t)]; });
  const X0 = range(300).map(() => [gauss(q), gauss(q)]);
  const c = canvas(box, 600, 360), P = plot(c, -3.17, 3.17, -1.9, 1.9, 6), { ctx } = c;
  const KS = [1, 2, 3, 4, 6, 8, 16, 32], r = row(box), ks = slider(r, 'Euler steps K', 0, 7, 1, 4, i => KS[i]), tt = slider(r, 'time t', 0, 1, 0.01, 1);
  const o = out(box), cache = {};
  const vel = ([x, y], t) => {                     // exact average velocity E[x1 - x0 | x_t] for this data set
    let m = Infinity; const d2 = data.map(([a, b]) => { const v = (x - t * a) ** 2 + (y - t * b) ** 2; m = Math.min(m, v); return v; });
    let sw = 0, vx = 0, vy = 0;
    data.forEach(([a, b], i) => { const w = Math.exp(-(d2[i] - m) / (2 * (1 - t) ** 2)); sw += w; vx += w * (a - x); vy += w * (b - y); });
    return [vx / sw / (1 - t), vy / sw / (1 - t)];
  };
  const paths = K => cache[K] || (cache[K] = X0.map(p => { const out = [p]; let cur = p; for (let k = 0; k < K; k++) { const v = vel(cur, k / K); cur = [cur[0] + v[0] / K, cur[1] + v[1] / K]; out.push(cur); } return out; }));
  return () => {
    const K = KS[ks.v], tv = tt.v, ps = paths(K), at = path => { const u = tv * K, k = Math.min(K - 1, Math.floor(u)), f = u - k; return [path[k][0] + f * (path[k + 1][0] - path[k][0]), path[k][1] + f * (path[k + 1][1] - path[k][1])]; };
    P.clear();
    data.forEach(([x, y]) => P.dot(x, y, 2.5, 'rgba(212,128,15,.55)'));
    X0.forEach(([x, y]) => P.dot(x, y, 1.6, '#c8c8c8'));
    ps.forEach(path => { const pts = path.filter((_, k) => k / K <= tv); pts.push(at(path)); P.path(pts, 'rgba(31,95,191,.18)', 1); });
    ps.forEach(path => { const [x, y] = at(path); P.dot(x, y, 2.4, C.blue); });
    const gap = sum(ps.map(path => { const [x, y] = path[K]; return Math.sqrt(Math.min(...data.map(([a, b]) => (x - a) ** 2 + (y - b) ** 2))); })) / ps.length;
    o.innerHTML = `K = ${K}: after the last step, samples sit on average <b>${f2(gap)}</b> from the nearest data point` + (K === 1 ? ' (one step sends every sample to the mean of the data)' : '');
  };
};

V.graphs = box => {
  const E = [[0, 1], [0, 2], [1, 2], [1, 3], [3, 4], [4, 5], [4, 6], [5, 6], [6, 7]], n = 8;
  const pos = [[45, 70], [110, 150], [45, 230], [170, 150], [230, 150], [290, 75], [290, 225], [230, 300]];
  const A = range(n).map(() => new Array(n).fill(0)); E.forEach(([i, j]) => (A[i][j] = A[j][i] = 1));
  const mul = (X, Y) => X.map(rw => range(n).map(j => sum(rw.map((v, m) => v * Y[m][j]))));
  const c = canvas(box, 600, 330), { ctx } = c;
  const ks = slider(row(box), 'walk length k', 1, 4, 1, 1);
  const o = out(box);
  let src = 0;
  c.cv.addEventListener('click', e => { const b = c.cv.getBoundingClientRect(), x = (e.clientX - b.left) * 600 / b.width, y = (e.clientY - b.top) * 330 / b.height; const d = pos.map(([a, bb]) => Math.hypot(a - x, bb - y)), i = d.indexOf(Math.min(...d)); if (d[i] < 30) { src = i; closestBox(c.cv).draw(); } });
  return () => {
    let Ak = A; for (let k = 1; k < ks.v; k++) Ak = mul(Ak, A);
    const dist = new Array(n).fill(-1), queue = [src]; dist[src] = 0;
    while (queue.length) { const u = queue.shift(); for (let v = 0; v < n; v++) if (A[u][v] && dist[v] < 0) { dist[v] = dist[u] + 1; queue.push(v); } }
    ctx.clearRect(0, 0, 600, 330); ctx.font = '14px Times New Roman'; ctx.textAlign = 'center';
    E.forEach(([i, j]) => { ctx.strokeStyle = '#aaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...pos[i]); ctx.lineTo(...pos[j]); ctx.stroke(); });
    pos.forEach(([x, y], i) => {
      const hit = Ak[src][i] > 0;
      ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fillStyle = i === src ? C.orange : hit ? 'rgba(31,95,191,.25)' : '#f2f2f2'; ctx.fill(); ctx.strokeStyle = i === src ? C.orange : hit ? C.blue : '#999'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillText(i, x, y + 5); ctx.fillStyle = C.green; ctx.font = '12px Times New Roman'; ctx.fillText(`d=${dist[i]}`, x + 24, y - 12); ctx.font = '14px Times New Roman';
    });
    const cs = 27, x0 = 370, y0 = 60, mx = Math.max(...Ak.flat());
    ctx.fillStyle = C.ink; ctx.fillText(['A', 'A²', 'A³', 'A⁴'][ks.v - 1], x0 + 4 * cs, 30);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i === src ? C.orange : C.gray; ctx.fillText(i, x0 - 12, y0 + i * cs + 18); ctx.fillStyle = C.gray; ctx.fillText(i, x0 + i * cs + cs / 2, y0 - 8);
      for (let j = 0; j < n; j++) {
        const v = Ak[i][j];
        ctx.fillStyle = v ? `rgba(31,95,191,${0.15 + 0.6 * v / mx})` : '#f5f5f5'; ctx.fillRect(x0 + j * cs, y0 + i * cs, cs - 2, cs - 2);
        ctx.fillStyle = C.ink; ctx.fillText(v, x0 + j * cs + cs / 2 - 1, y0 + i * cs + 18);
      }
    }
    ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.strokeRect(x0 - 1, y0 + src * cs - 1, n * cs, cs);
    ctx.font = FONT;
    o.innerHTML = `node ${src}: degree ${sum(A[src])}; walks of length ${ks.v} from it: ${Ak[src].map((v, j) => v ? `${v} to node ${j}` : '').filter(Boolean).join(', ')}. Green labels: shortest distances from node ${src} (BFS). Click a node to start from it.`;
  };
};

V.pagerank = box => {
  const links = [[1, 2], [2], [0], [2], [2, 3], [4], [4, 5], []], n = 8;
  const pos = [[70, 85], [150, 40], [130, 175], [60, 270], [190, 270], [290, 240], [300, 120], [300, 30]];
  const c = canvas(box, 600, 320), { ctx } = c;
  const r = row(box), al = slider(r, 'α (follow a link)', 0, 0.99, 0.01, 0.85);
  let pi = new Array(n).fill(1 / n), it = 0, page = 0, visits = new Array(n).fill(0), walk = false, lastA = al.v;
  const step = () => { const a = al.v, nxt = new Array(n).fill((1 - a) / n); pi.forEach((p, i) => (links[i].length ? links[i].forEach(j => (nxt[j] += a * p / links[i].length)) : range(n).forEach(j => (nxt[j] += a * p / n)))); const ch = sum(nxt.map((v, i) => Math.abs(v - pi[i]))); pi = nxt; it++; return ch; };
  let change = 0;
  const r2 = row(box);
  button(r2, 'Step', () => (change = step()));
  button(r2, 'Converge', () => { for (let k = 0; k < 500 && (change = step()) > 1e-12; k++); });
  button(r2, 'Reset', () => { pi = new Array(n).fill(1 / n); it = 0; change = 0; visits.fill(0); });
  button(r2, 'Walk / pause the surfer', () => (walk = !walk));
  const o = out(box), q = rng(5);
  for (let k = 0; k < 500 && (change = step()) > 1e-12; k++);   // open on the converged ranking
  loop(box, () => { if (!walk) return; for (let k = 0; k < 40; k++) { const L = links[page]; page = q() < al.v && L.length ? L[Math.floor(q() * L.length)] : Math.floor(q() * n); visits[page]++; } box.draw(); });
  return () => {
    if (al.v !== lastA) { lastA = al.v; pi = new Array(n).fill(1 / n); it = 0; visits.fill(0); for (let k = 0; k < 500 && (change = step()) > 1e-12; k++); }   // a new α: converge again
    ctx.clearRect(0, 0, 600, 320); ctx.font = '13px Times New Roman'; ctx.textAlign = 'center';
    const rad = i => 10 + 60 * Math.sqrt(pi[i] / 1.5);
    links.forEach((L, i) => L.forEach(j => {
      const [x1, y1] = pos[i], [x2, y2] = pos[j], d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      parrow(ctx, x1 + ux * rad(i), y1 + uy * rad(i), x2 - ux * (rad(j) + 2), y2 - uy * (rad(j) + 2), '#999', 1.3);
    }));
    pos.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, rad(i), 0, 7); ctx.fillStyle = 'rgba(31,95,191,.18)'; ctx.fill(); ctx.strokeStyle = walk && i === page ? C.orange : C.blue; ctx.lineWidth = walk && i === page ? 3 : 1.5; ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillText(i, x, y + 5);
    });
    ctx.fillStyle = C.gray; ctx.fillText('page 7: no links out', 300, 72);
    const tot = sum(visits) || 1, bw = 26, x0 = 380, base = 270, sc = 480;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * bw;
      ctx.fillStyle = 'rgba(31,95,191,.6)'; ctx.fillRect(x + 3, base - sc * pi[i], bw - 8, sc * pi[i]);
      if (sum(visits)) { ctx.strokeStyle = C.orange; ctx.lineWidth = 2; ctx.strokeRect(x + 3, base - sc * visits[i] / tot, bw - 8, sc * visits[i] / tot); }
      ctx.fillStyle = C.gray; ctx.fillText(i, x + bw / 2 - 1, base + 15);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText('PageRank (blue) and the surfer\'s visit shares (orange)', 370, 300);
    ctx.font = FONT;
    const rank = range(n).sort((a, b) => pi[b] - pi[a]);
    o.innerHTML = `iteration ${it}` + (it ? `, change ‖π<sub>t</sub> − π<sub>t−1</sub>‖₁ = ${change.toExponential(1)}; ranking: ${rank.join(' > ')}` : ': every page starts at 1/8') + (sum(visits) ? `; the surfer has made ${sum(visits).toLocaleString()} moves` : '');
  };
};
