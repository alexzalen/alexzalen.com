/* Background tone: one grey level g (0..255) drives every colour variable. Loaded in <head> before style.css. */
// ?fresh in the URL (any value): forget everything this site stored in this browser (language choice, colours, tone, depth, bands, intro seen,
// glitch tier) and start as a first visit; the parameter is then removed from the address bar. URL-only on purpose: there is no button for it.
// tone.js is the first script on every page, so this runs before anything reads storage.
(function () {
  try {
    var u = new URL(location.href);
    if (!u.searchParams.has('fresh')) return;
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    u.searchParams.delete('fresh');
    history.replaceState(history.state, '', u.pathname + (u.search ? u.search : '') + u.hash);
  } catch (e) {}
})();
(function () {
  'use strict';
  var d = document.documentElement;
  window.UI_DEFAULTS = { tone: 128, depth: 100, palette: 'green' };   // shipped defaults (what a first visit shows); the reset button uses these
  function grey(v) { return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  // Depth colour ramp (far -> near). The far end is SOLVED, not tabulated: it is the colour on the palette's line closest to the background whose effective contrast
  // (the colour composited at the faintest glyph opacity `a0` over the grey background) is still >= TARGET:1. Near end: white (g<FLIP) or the palette's dark near colour (g>=FLIP): near = the strongest contrast.
  // Each palette's line runs from a near-black `deep` through the saturated `hue` to a pale tint `pale`; its luminance rises monotonically with u in [-1, 1].
  // 'blue' is the original ramp (same constants, same output). The others share the structure and the constraints (provenance/palettes.md).
  var W = [255, 255, 255], BLUE = [40, 80, 255], TARGET = 3.1, STRONG = 4.5, DARKMIN = 90, FLIP = 149;   // near end = white up to g=148 (white vs bg still 3.03:1 at 148), dark near from FLIP=149; far end = dark tint wherever a dark colour can beat the background (g>=DARKMIN), else pale tint
  // acc / line: per-palette PPA accent and leader/border line [dark page g<118, mid g<150, light page]; null = the shared orange accent / pink line
  var PAL = {
    blue:   { hue: [40, 80, 255],   deep: [2, 3, 20],   pale: [225, 236, 255], nv: [4, 10, 44] },
    rose:   { hue: [235, 45, 135],  deep: [9, 0, 5]  ,  pale: [255, 226, 240], nv: [48, 4, 26],  line: ['150,235,185', '150,235,185', '0,105,70'] },
    amber:  { hue: [225, 150, 0],   deep: [6, 4, 0]  ,  pale: [255, 238, 190], nv: [44, 26, 0],  acc: ['70,175,255', '0,95,255', '0,55,190'] },
    green:  { hue: [20, 170, 60],   deep: [0, 6, 2]  ,   pale: [215, 250, 222], nv: [4, 38, 12] },
    teal:   { hue: [0, 160, 175],   deep: [0, 5, 6]  ,  pale: [210, 248, 248], nv: [2, 36, 40] },
    violet: { hue: [140, 60, 255],  deep: [5, 1, 14]  ,  pale: [235, 226, 255], nv: [26, 8, 52], line: ['150,235,185', '150,235,185', '0,105,70'] },
    mono:   { hue: [118, 118, 118], deep: [0, 0, 0],    pale: [255, 255, 255], nv: [0, 0, 0], gap: true }
  };
  window.PALETTES = Object.keys(PAL);
  // Colour-opponent position (provenance/palettes.md, "Colour sliders"). Two sliders like the retina's opponent channels: yb = yellow (-1) .. blue (+1), the CIELAB -b* axis,
  // gr = green (-1) .. red (+1), the CIELAB +a* axis; a* = 100 gr, b* = -100 yb. Each palette sits at the (a*, b*) of its saturated `hue` colour / 100 (rounded to the
  // slider step 0.01, computed from PAL by test HU1); mono at 0,0. Note the sRGB blue [40,80,255] has a* = +50: in CIELAB a saturated blue leans to the red side.
  var HUE = { blue: [0.89, 0.50], rose: [0.03, 0.75], amber: [-0.73, 0.19], green: [-0.45, -0.59], teal: [0.18, -0.29], violet: [0.83, 0.71], mono: [0, 0] };
  window.HUE_PRESETS = HUE;
  var curYB = HUE.green[0], curGR = HUE.green[1];   // default colour: green (Alex, 2026-11-05)
  window.UI_DEFAULTS.hueYB = HUE.green[0]; window.UI_DEFAULTS.hueGR = HUE.green[1]; window.UI_DEFAULTS.bands = 0;   // bands: 0 = soft (48 bins) .. 100 = stepped (8 bins, the old look); the control offers these two ends, soft by default (Alex, 2026-11-16)
  function presetAt(yb, gr) { for (var k in HUE) if (Math.abs(HUE[k][0] - yb) < 0.005 && Math.abs(HUE[k][1] - gr) < 0.005) return k; return null; }
  function q2(v) { v = Math.max(-1, Math.min(1, +v || 0)); return Math.round(v * 100) / 100; }
  window.palette = function () { return presetAt(curYB, curGR) || 'custom'; };   // preset name at the current slider position, or 'custom'
  window.paletteOk = function (n) { return Object.prototype.hasOwnProperty.call(PAL, n); };
  window.setPaletteName = function (n) { if (window.paletteOk(n)) { curYB = HUE[n][0]; curGR = HUE[n][1]; } return window.palette(); };   // a preset = slider positions; the caller re-applies the tone (applyTone + ramp)
  window.setHue = function (yb, gr) { curYB = q2(yb); curGR = q2(gr); return [curYB, curGR]; };
  window.hue = function () { return [curYB, curGR]; };
  // The whole ramp stays on ONE side of the background luminance, so no intermediate bin falls near the background grey.
  function mix(a, b, t) { return [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * t); }); }
  function rlin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function rlum(c) { return 0.2126 * rlin(c[0]) + 0.7152 * rlin(c[1]) + 0.0722 * rlin(c[2]); }
  function onLine(P, u) { return u < 0 ? mix(P.hue, P.deep, -u) : mix(P.hue, P.pale, u); }
  function eff(c, a, g) { var q = c.map(function (v) { return a * v + (1 - a) * g; }), x = rlum(q), y = rlum([g, g, g]); if (x < y) { var t = x; x = y; y = t; } return (x + 0.05) / (y + 0.05); }
  function solveFar(P, g, a0) {
    var lo, hi, i, m;
    // while near is white the far end aims at STRONG (4.5:1) effective contrast; if the opacity tier makes that unreachable it takes the darkest tint (max contrast)
    var T = g < FLIP ? STRONG : TARGET;
    // dark side: largest u in [-1, 0.5] with eff >= TARGET and luminance below the background (needs eff to rise as u falls)
    var bgL = rlum([g, g, g]), dark = null, pale = null;
    if (g >= DARKMIN) {
      lo = -1; hi = 0.5;   // lo = darkest tint; find the palest one that still meets T
      for (i = 0; i < 24; i++) { m = (lo + hi) / 2; var c = onLine(P, m), q = c.map(function (v) { return a0 * v + (1 - a0) * g; }); if (rlum(q) < bgL && eff(c, a0, g) >= T) lo = m; else hi = m; }
      dark = lo;
    }
    if (dark === null && eff(onLine(P, 1), a0, g) >= TARGET) {
      lo = -0.2; hi = 1;
      for (i = 0; i < 24; i++) { m = (lo + hi) / 2; var c2 = onLine(P, m), q2 = c2.map(function (v) { return a0 * v + (1 - a0) * g; }); if (rlum(q2) > bgL && eff(c2, a0, g) >= TARGET) hi = m; else lo = m; }
      pale = hi;
    }
    var u = dark !== null ? dark : pale !== null ? pale : 1;
    return onLine(P, u);
  }
  // neutral ramp across the background (mono, far dark -> near white): a grey ramp has no hue to carry the bins that pass the background grey. Until
  // 2026-11-05 those bins were skipped (one jump from dark to light grey, which read as a glitchy band, worst with many bins). Now the bins are spread
  // continuously in L* from far to near, with steps up to 2.2x wider within ~8 L* of the background (the ramp hurries past the invisible greys, no jump).
  function lstar(c) { var y = rlum(c); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; }
  function greyOfL(L) { var y = L > 8 ? Math.pow((L + 16) / 116, 3) : L / 903.3, v = y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055; v = Math.round(Math.max(0, Math.min(1, v)) * 255); return [v, v, v]; }
  var GAPK = 1.2, GAPW = 8;
  function gapRamp(far, near, g, n) {
    var a = lstar(far), e = lstar(near), m = lstar([g, g, g]), S = 400, cum = [0], i, k, out = [];
    for (i = 1; i <= S; i++) { var L = a + (e - a) * (i - 0.5) / S, d = (L - m) / GAPW; cum.push(cum[i - 1] + 1 / (1 + GAPK * Math.exp(-d * d))); }   // cost per unit L*: lower near the background
    for (i = 0, k = 0; i < n; i++) {
      var x = n > 1 ? cum[S] * i / (n - 1) : cum[S]; while (k < S - 1 && cum[k + 1] < x) k++;
      var f = cum[k + 1] > cum[k] ? Math.max(0, Math.min(1, (x - cum[k]) / (cum[k + 1] - cum[k]))) : 0;
      out.push(greyOfL(a + (e - a) * (k + f) / S));
    }
    out[0] = far.slice(); out[n - 1] = near.slice();
    return out;
  }
  // newer palettes: bins at equal CIELAB distance along the far -> (hue ->) near polyline (perceptually even steps; blue keeps its original t^0.8 spacing)
  function lab(c) { var r = rlin(c[0]), g = rlin(c[1]), b = rlin(c[2]), f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }, X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; }
  function evenRamp(stops, n) {
    var pts = [], d = [0], i, k, S = 32;
    for (i = 0; i + 1 < stops.length; i++) for (k = i ? 1 : 0; k <= S; k++) { var a = stops[i], b = stops[i + 1]; pts.push([0, 1, 2].map(function (j) { return a[j] + (b[j] - a[j]) * k / S; })); }
    for (i = 1; i < pts.length; i++) { var p = lab(pts[i - 1]), q = lab(pts[i]); d.push(d[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
    var tot = d[d.length - 1], out = [];
    for (i = 0, k = 0; i < n; i++) {
      var x = n > 1 ? tot * i / (n - 1) : tot; while (k < d.length - 2 && d[k + 1] < x) k++;
      var t = d[k + 1] > d[k] ? Math.min(1, Math.max(0, (x - d[k]) / (d[k + 1] - d[k]))) : 0;
      out.push([0, 1, 2].map(function (j) { return Math.round(pts[k][j] + (pts[k + 1][j] - pts[k][j]) * t); }));
    }
    return out;
  }
  // ---- opponent position -> palette line ----
  // Anchors: the 6 chromatic presets, sorted by their hue angle h = atan2(b*, a*) in the slider plane. For any position (radius r, angle h) the line colours
  // (deep, hue, pale, nv) are interpolated in CIELAB LCh between the two neighbouring anchors (L and C linear, h along the short arc), then their chroma is
  // scaled by r / r_ref (r_ref = the anchors' radius, interpolated the same way) and clipped to the sRGB gamut at constant L and h. L* never changes, so the
  // line keeps its luminance order (deep < hue < pale) and solveFar keeps every contrast bar. At a preset position the preset's own constants are used (exact).
  function lab2rgb(L, a, b) {
    var fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = function (t) { var t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
    var X = 0.95047 * inv(fx), Y = inv(fy), Z = 1.08883 * inv(fz);
    return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];   // linear RGB (may be out of 0..1)
  }
  function enc(v) { v = Math.max(0, Math.min(1, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
  function lch(c) { var p = lab(c); return [p[0], Math.hypot(p[1], p[2]), Math.atan2(p[2], p[1])]; }
  function fromLch(L, C, h) {   // in-gamut sRGB: chroma reduced (bisection) until all channels fit
    var lo = 0, hi = C, x = lab2rgb(L, C * Math.cos(h), C * Math.sin(h)), ok = function (q) { return q[0] >= -1e-4 && q[0] <= 1.0001 && q[1] >= -1e-4 && q[1] <= 1.0001 && q[2] >= -1e-4 && q[2] <= 1.0001; };
    if (!ok(x)) { for (var i = 0; i < 18; i++) { var m = (lo + hi) / 2; if (ok(lab2rgb(L, m * Math.cos(h), m * Math.sin(h)))) lo = m; else hi = m; } x = lab2rgb(L, lo * Math.cos(h), lo * Math.sin(h)); }
    return x.map(enc);
  }
  var KEYS = ['deep', 'hue', 'pale', 'nv'], ANCH = Object.keys(HUE).filter(function (k) { return k !== 'mono'; }).map(function (k) {
    var o = { name: k, r: Math.hypot(HUE[k][0], HUE[k][1]), h: Math.atan2(-HUE[k][0], HUE[k][1]) };
    KEYS.forEach(function (c) { o[c] = lch(PAL[k][c]); }); return o;
  }).sort(function (a, b) { return a.h - b.h; });
  function arc(a, b, f) { var d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }
  var lineCache = {};
  function lineAt(yb, gr) {   // palette line {deep, hue, pale, nv, name, r, wc} for a slider position
    var key = yb + ',' + gr; if (lineCache[key]) return lineCache[key];
    var pn = presetAt(yb, gr), r = Math.hypot(yb, gr), P;
    if (pn) P = { deep: PAL[pn].deep, hue: PAL[pn].hue, pale: PAL[pn].pale, nv: PAL[pn].nv };
    else {
      var h = Math.atan2(-yb, gr), n = ANCH.length, i = 0;
      while (i < n && ANCH[i].h <= h) i++;
      var A = ANCH[(i - 1 + n) % n], B = ANCH[i % n], span = B.h - A.h; if (span <= 0) span += 2 * Math.PI;
      var dh = h - A.h; if (dh < 0) dh += 2 * Math.PI; var f = dh / span, rref = A.r + (B.r - A.r) * f, s = rref > 0 ? r / rref : 0;
      P = {}; KEYS.forEach(function (c) { var p = A[c], q = B[c]; P[c] = fromLch(p[0] + (q[0] - p[0]) * f, (p[1] + (q[1] - p[1]) * f) * s, arc(p[2], q[2], f)); });
    }
    P.name = pn; P.r = r;
    var db = Math.hypot(yb - HUE.blue[0], gr - HUE.blue[1]);
    P.wc = db < 0.15 ? sstep(1 - db / 0.15) : 0;   // weight of blue's original t^0.8 sRGB spacing (1 at the blue preset, fading to the even CIELAB spacing within 0.15; violet is 0.22 away)
    P.wm = pn === 'mono' ? 1 : r < 0.25 ? 1 - sstep(r / 0.25) : 0;   // weight of the mono ramp (its gap across the background) near the neutral centre
    var ks = Object.keys(lineCache); if (ks.length > 64) lineCache = {};
    lineCache[key] = P; return P;
  }
  function sstep(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  function rampOf(P, g, n, a0) {   // the original per-palette ramp rules, for any line
    var far = solveFar(P, g, a0), near = g < FLIP ? W : P.nv, out = [], i;
    if (P.gap && near === W && rlum(far) < rlum([g, g, g])) return gapRamp(far, near, g, n);
    var mid = rlum(far) < rlum(P.hue) && near === W;   // dark far -> white near passes through the pure hue so the middle bins keep the hue
    var wc = P.wc || 0, ev = wc < 1 ? evenRamp(mid ? [far, P.hue, W] : [far, near], n) : null;
    if (wc <= 0) return ev;
    for (i = 0; i < n; i++) { var t = n > 1 ? Math.pow(i / (n - 1), 0.8) : 1; out.push(mid ? (t < 0.5 ? mix(far, P.hue, t * 2) : mix(P.hue, W, (t - 0.5) * 2)) : mix(far, near, t)); }
    return ev ? blend(ev, out, wc) : out;
  }
  function blend(A, B, w) {   // per bin, in linear RGB: two ramps on the same side of the background keep monotone luminance and the contrast of the weaker end
    return A.map(function (a, i) { return [0, 1, 2].map(function (k) { return enc(rlin(a[k]) * (1 - w) + rlin(B[i][k]) * w); }); });
  }
  function monotone(out) {   // with many bins, 8-bit rounding (or an sRGB segment whose channels move in opposite directions) can undo a tiny luminance step: repeat the previous bin instead
    var n = out.length, up = rlum(out[n - 1]) > rlum(out[0]);
    for (var i = 1; i < n; i++) { var d = rlum(out[i]) - rlum(out[i - 1]); if (up ? d < 0 : d > 0) out[i] = out[i - 1].slice(); }
    return out;
  }
  function rampAt(yb, gr, g, n, a0) {
    var P = lineAt(yb, gr);
    if (P.wm >= 1) return monotone(rampOf(PAL.mono, g, n, a0));
    var R = rampOf(P, g, n, a0);
    return monotone(P.wm > 0 ? blend(R, rampOf(PAL.mono, g, n, a0), P.wm) : R);
  }
  // a0 = opacity of the faintest tier (brain.js passes CFG.depthTier[0]); name = a preset (default: the current slider position). Returns n [r,g,b] arrays, index 0 = farthest.
  window.depthRamp = function (g, n, a0, name) {
    g = Math.max(0, Math.min(255, Math.round(+g) || 0)); n = n || 8; a0 = a0 > 0 ? Math.min(1, a0) : 0.85;
    var p = HUE[name] || [curYB, curGR];
    return rampAt(p[0], p[1], g, n, a0);
  };
  window.depthRampAt = function (yb, gr, g, n, a0) { return rampAt(q2(yb), q2(gr), Math.max(0, Math.min(255, Math.round(+g) || 0)), n || 8, a0 > 0 ? Math.min(1, a0) : 0.85); };
  // PPA accent = the visual opposite of the chosen colour: the opponent position negated (yellow <-> blue, green <-> red), i.e. hue + 180 deg in the CIELAB
  // a*b* plane, at the lightness of the old orange accent for the page class [dark page g<118, mid g<150, light page] and the strongest chroma sRGB has there.
  // The lightness is searched per page class (old orange L -20..+15) for >= 48 dE76 from the ramp. Near the neutral centre (radius < 0.25) it fades to the old orange (the neutral/mono default, which has no opposite).
  // Leader/border line: pink unless it comes closer than 30 dE76 to some ramp colour (8 bins, all 256 tones), then mint if farther (rose, violet -> mint as before).
  var ORANGE = ['255,165,60', '255,125,0', '190,60,0'], LIN = [['255,150,205', '255,180,220', '185,0,130'], ['150,235,185', '150,235,185', '0,105,70']];
  var choiceCache = {};
  function dE(a, b) { var p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
  function accentCands(yb, gr, k) {   // candidate accents for page class k: the opposite hue at lightness L0-20 .. L0+15 (L0 = the old orange's), faded to orange near the centre
    var r = Math.hypot(yb, gr), w = sstep((r - 0.05) / 0.2), hc = Math.atan2(yb, -gr), ol = lch(ORANGE[k].split(',').map(Number)), out = [];
    if (w <= 0) return [ORANGE[k].split(',').map(Number)];
    for (var dl = 0; dl <= 35; dl += 5) {
      var L = ol[0] + [0, -5, 5, -10, 10, -15, 15, -20][dl / 5], c = lch(fromLch(L, 150, hc));   // the strongest chroma sRGB has at that lightness and hue
      out.push(fromLch(ol[0] + (c[0] - ol[0]) * w, ol[1] + (c[1] - ol[1]) * w, arc(ol[2], c[2], w)));   // fade in LCh (hue along the short arc): no greyish in-between
    }
    return out;
  }
  function choiceAt(yb, gr) {
    var key = yb + ',' + gr; if (choiceCache[key]) return choiceCache[key];
    var cand = [0, 1, 2].map(function (k) { return accentCands(yb, gr, k); }), ma = cand.map(function (c) { return c.map(function () { return 1e9; }); });
    var m = [1e9, 1e9], g, c, k, j, refs = LIN.map(function (L) { return L.map(function (s) { return s.split(',').map(Number); }); });
    for (g = 0; g <= 255; g++) {
      var R = rampAt(yb, gr, g, 8, 0.85), t = g < 118 ? 0 : g < 150 ? 1 : 2;
      for (j = 0; j < R.length; j++) { for (c = 0; c < 2; c++) { k = dE(R[j], refs[c][t]); if (k < m[c]) m[c] = k; } for (c = 0; c < cand[t].length; c++) { k = dE(R[j], cand[t][c]); if (k < ma[t][c]) ma[t][c] = k; } }
    }
    // per page class: the first candidate (closest to the orange's lightness) that stays >= 48 dE76 from the ramp, else the farthest one
    var acc = [], dAcc = [];
    for (t = 0; t < 3; t++) { var bi = 0; for (c = 0; c < cand[t].length; c++) { if (ma[t][c] >= 48) { bi = c; break; } if (ma[t][c] > ma[t][bi]) bi = c; } acc.push(cand[t][bi].join(',')); dAcc.push(ma[t][bi]); }
    var out = { acc: acc, line: m[0] >= 30 || m[0] >= m[1] ? 0 : 1, dAcc: dAcc, dLine: m };
    if (Object.keys(choiceCache).length > 64) choiceCache = {};
    choiceCache[key] = out; return out;
  }
  function posOf(name) { return HUE[name] || [curYB, curGR]; }
  window.paletteChoice = function (name) { var p = posOf(name); return choiceAt(p[0], p[1]); };
  window.paletteAccent = function (g, name) { var p = posOf(name), k = g < 118 ? 0 : g < 150 ? 1 : 2; return choiceAt(p[0], p[1]).acc[k]; };
  window.paletteLine = function (g, name) { var p = posOf(name), k = g < 118 ? 0 : g < 150 ? 1 : 2; return 'rgb(' + LIN[choiceAt(p[0], p[1]).line][k] + ')'; };
  // swatch colour for the chooser: the palette's own hue (constant over tones, so the buttons don't shift); without a name: the current position's hue colour
  window.paletteSwatch = function (name) { var P = PAL[name] || lineAt(curYB, curGR); return 'rgb(' + P.hue.join(',') + ')'; };
  function lum(c) { return c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce(function (a, v, k) { return a + v * [0.2126, 0.7152, 0.0722][k]; }, 0); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function css(c) { return 'rgb(' + c.join(',') + ')'; }
  function contactColours(g) {
    var bg = [g, g, g], K = [0, 0, 0], Wt = [255, 255, 255], TARGET = 4.55;
    var fg = ratio(K, bg) >= ratio(Wt, bg) ? K : Wt;
    function toward(base, end) { for (var t = 0; t <= 1.0001; t += 0.01) { var c = mix(base, end, t); if (ratio(c, bg) >= TARGET) return { c: c, t: t }; } return null; }
    var d = toward([0, 30, 150], K), l = toward([170, 225, 255], Wt), pick = d && l ? (d.t <= l.t ? d : l) : (d || l);
    return { fg: css(fg), link: css(pick ? pick.c : fg) };
  }
  // Label boxes (Alex: "based on the opponent colour of the PPA area", not just darker): the box fill is a tint of the accent hue (CIELAB chroma LBL_C)
  // at the lightness of the old grey box (16 grey levels lighter than a dark page, darker than a light one), drawn at LBL_A over the page. Text = the better
  // of black/white on the composited box; if that is below 4.55:1 the box lightness moves away from the text until it passes. The dim tag line is pushed
  // toward the text colour until >= 4.55:1.
  var LBL_D = 16, LBL_A = 0.92, LBL_C = 34;
  function labelColours(g, name) {
    var acc = lch(window.paletteAccent(g, name).split(',').map(Number)), gb = g < 118 ? g + LBL_D : g - LBL_D, L0 = lstar([gb, gb, gb]), K = [0, 0, 0], Wt = [255, 255, 255];
    var comp = function (c) { return c.map(function (v) { return Math.round(LBL_A * v + (1 - LBL_A) * g); }); }, box, q, fg, best, L = L0, dir = 0;
    for (var it = 0; it < 60; it++) {
      box = fromLch(Math.max(0, Math.min(100, L)), Math.min(LBL_C, acc[1]), acc[2]); q = comp(box);
      fg = ratio(K, q) >= ratio(Wt, q) ? K : Wt; best = Math.min(ratio(fg, q), ratio(fg, box)); if (best >= 4.55) break;   // on the composite and on the raw fill
      if (!dir) dir = fg === K ? 1 : -1; L += dir;   // away from the text colour
    }
    var dim = fg;
    for (var t = 0.6; t <= 1.0001; t += 0.01) { var c = mix(q, fg, t); if (Math.min(ratio(c, q), ratio(c, box)) >= 4.55) { dim = c; break; } }
    return { box: box, q: q, fg: css(fg), dim: css(dim) };
  }
  // The PPA accent is also the site's attention / interface colour (Alex: "the whole interface takes the PPA colour, except the brain").
  // --accent = the vivid colour (glow, PPA letters); --accent-ui (= --line: leaders, label borders, focus rings, swatch ring, slider tracks, cursor) >= 3:1 and
  // --accent-text (= --link: name, panel text and thumbs, links, PPA info line, footer) >= 4.5:1 against the page grey (and the label box for the UI variant):
  // same CIELAB hue and chroma, the lightness moved (lighter on dark pages g < 118, darker on light ones, like the ink) until it reaches the ratio.
  // Shades of the PPA hue: the same CIELAB hue as the vivid accent, but at every lightness the MAXIMUM chroma sRGB allows there (not the vivid chroma clipped,
  // which gave muddy brown). The lightness is the nearest one (to the vivid accent's) that reaches the contrast target in the allowed direction(s); with both
  // directions allowed, the one with the more colourful result wins (a pale pink or a deep plum, whichever is more saturated at that page grey).
  // Only where neither side is both saturated and 4.5:1 (text on a mid grey, tones ~105-135) does the result approach black/white, but it stays tinted when it can.
  function accentVariant(acc, bgs, target, dir) {
    var c = acc.split(',').map(Number), ok = function (q) { return bgs.every(function (b) { return ratio(q, b) >= target; }); };
    var l = lch(c), best = null;
    [-1, 1].forEach(function (sg) {
      if (dir && dir !== sg) return;
      for (var d = 0; d <= 200; d += 0.5) {
        var L = l[0] + sg * d; if (L < 0 || L > 100) break;
        var q = fromLch(L, 200, l[2]); if (!ok(q)) continue;
        var ch = lch(q)[1]; if (!best || ch > best.ch + 0.5) best = { q: q, ch: ch }; break;
      }
    });
    if (best) return best.q;
    if (dir) return accentVariant(acc, bgs, target);   // the wanted side cannot reach the ratio: take any side
    return ratio([0, 0, 0], bgs[0]) > ratio([255, 255, 255], bgs[0]) ? [0, 0, 0] : [255, 255, 255];
  }
  window.accentVariants = function (g, name) {
    g = Math.max(0, Math.min(255, Math.round(+g) || 0)); var acc = window.paletteAccent(g, name), lc = labelColours(g, name), P = [g, g, g];
    var ui = accentVariant(acc, [P], 3.05), text = accentVariant(acc, [P], 4.55), deep = accentVariant(acc, [P, lc.q], 3.05, -1);   // deep = the darker shade for the label border
    var K = [0, 0, 0], Wt = [255, 255, 255], on = ratio(K, ui) >= ratio(Wt, ui) ? K : Wt;   // text on a UI-colour fill (active toggle, selection)
    return { vivid: acc, ui: ui.join(','), text: text.join(','), deep: deep.join(','), on: on.join(','), box: lc.q.join(','), boxFg: lc.fg, boxDim: lc.dim };
  };
  window.applyTone = function (g) {
    g = Math.max(0, Math.min(255, Math.round(+g)));
    if (g !== g) g = 128;
    var i = g < 118 ? 235 : 0;                                   // ink flips at 118 (visible jump)
    function m(f) { return Math.round(g + (i - g) * f); }
    var accent = window.paletteAccent(g);
    var s = d.style;
    s.setProperty('--bg', grey(g));
    s.setProperty('--ink', i + ',' + i + ',' + i);
    s.setProperty('--fg', grey(i));
    s.setProperty('--dim', grey(m(0.6)));
    s.setProperty('--border', grey(m(0.2)));
    s.setProperty('--foot', grey(m(0.45)));
    s.setProperty('--foot-a', grey(m(0.65)));
    s.setProperty('--card-fg', grey(m(0.85)));
    s.setProperty('--pill', 'rgba(' + g + ',' + g + ',' + g + ',.85)');
    s.setProperty('--plate', 'rgba(' + g + ',' + g + ',' + g + ',.7)');
    s.setProperty('--card', 'rgba(' + g + ',' + g + ',' + g + ',.96)');
    s.setProperty('--accent', accent);
    s.setProperty('--halo', 'rgba(' + accent + ',.35)');
    var av = window.accentVariants(g);
    s.setProperty('--accent-ui', 'rgb(' + av.ui + ')'); s.setProperty('--accent-text', 'rgb(' + av.text + ')');
    s.setProperty('--accent-deep', 'rgb(' + av.deep + ')'); s.setProperty('--accent-on', 'rgb(' + av.on + ')'); s.setProperty('--accent-soft', 'rgba(' + av.ui + ',.22)');   // label border / fill text of toggles / soft hover fill
    s.setProperty('--line', 'rgb(' + av.ui + ')');     // leaders, label borders, focus rings: the accent (UI variant)
    s.setProperty('--link', 'rgb(' + av.text + ')');   // name, links, info line, slider thumbs: the accent (text variant)
    // contact line only: text and link colours reach >= 4.5:1 against the grey at every tone (black/white text; link = blue family pushed toward black or white until it passes)
    var lc = labelColours(g); s.setProperty('--lbl-bg', 'rgba(' + lc.box.join(',') + ',' + LBL_A + ')'); s.setProperty('--lbl-fg', lc.fg); s.setProperty('--lbl-dim', lc.dim);
    s.setProperty('--lsh', g < 118 ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.32)');
    var ct = contactColours(g); s.setProperty('--ct-fg', ct.fg); s.setProperty('--ct-link', 'rgb(' + av.text + ')');
    var dr = window.depthRamp(g, 2, 0.85); s.setProperty('--depth-far', 'rgb(' + dr[0] + ')'); s.setProperty('--depth-near', 'rgb(' + dr[1] + ')');
    s.setProperty('color-scheme', g < 118 ? 'dark' : 'light');
    var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', grey(g));
    return { ink: i + ',' + i + ',' + i, accent: accent, halo: 'rgba(' + accent + ',.35)', i: i };
  };
  try {   // stored slider positions ('hueYB', 'hueGR'); the older 'palette' key maps to its preset position
    var pv = localStorage.getItem('palette'), hy = localStorage.getItem('hueYB'), hg = localStorage.getItem('hueGR'), num = /^-?(0|1)(\.\d{1,2})?$/;
    if (pv && window.paletteOk(pv)) window.setPaletteName(pv);
    if (hy !== null && num.test(hy)) curYB = q2(hy);
    if (hg !== null && num.test(hg)) curGR = q2(hg);
  } catch (e) {}
  try {
    var t = localStorage.getItem('tone'), g = window.UI_DEFAULTS.tone;
    if (t !== null && /^\d{1,3}$/.test(t) && +t <= 255) g = +t;
    window.applyTone(g);
  } catch (e) { try { window.applyTone(window.UI_DEFAULTS.tone); } catch (e2) {} }
})();
