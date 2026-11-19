(function () {
  'use strict';
  const meshReq = fetch('brain.bin.gz');   // started first, so the download runs while the page sets itself up (loadMesh waits for it)
  // ---- tunables (edit here) ----
  const CFG = {
    weight: 500,                    // font weight of the ASCII glyphs (bolder = heavier looking brain)
    contourAlpha: [0, 1, 0.92, 0.6],// contour mode opacity: [unused, silhouette, sulcal lines, deep fill dots]
    depthColor: true,               // colour glyphs by distance from the viewer (far = dark blue ... near = white on dark backgrounds); false = one ink colour
    depthBins: 8,                   // number of depth colour bins (= fill style changes per frame, times 3 opacity tiers); set by the bands control (soft = 48, stepped = 8: the two ends; the internal hook takes 0..100: 48 .. 8), see binsOf()
    depthBinsMin: 8, depthBinsMax: 48,
    depthHyst: 0.2,                 // hysteresis (in bins / tiers) before a cell changes depth bin or opacity tier: stops boundary flicker while rotating
    depthHystK: 1.25,               // with more bins the bin hysteresis grows as depthHyst * (bins / 8)^depthHystK bins (0 = fixed in bins, 1 = fixed in depth; 1.25 measured: blink 0.02-0.03% at 24/48 bins)
    depthLoR: -0.30,                // fixed depth range as fractions of the mesh radius R (max vertex distance from the centre): nearest end = +depthHiR*R, farthest = depthLoR*R
    depthHiR: 0.80,
    depthTier: [0.85, 0.93, 1],     // opacity of faint / medium / dense 3D glyphs when depth colour is on
    ramp: ' .,:;-=+*#%@',           // 3D mode: characters from empty to densest
    vMin: 0.12,                     // 3D mode: values below this draw nothing (higher = more empty dim areas)
    depthCut: 0.45,                 // 3D mode: sulcal depth (0..1) where darkening in the grooves starts
    depthK: 0.62,                   // 3D mode: how strongly grooves are darkened
    contrast: 1.2,                  // 3D mode: contrast around mid grey (higher = bolder)
    gamma: 0.9,                     // 3D mode: <1 brighter mid tones, >1 darker
    shadeMin: 0.32,                 // 3D mode: opacity of the faintest visible glyph (1 = all equally strong)
    ppaPulseMs: 3000,               // PPA breathing period (ms): slow sinusoid while the PPA is not selected
    ppaPulseMin: 0.14,              // PPA highlight alpha at the low point of the breath
    ppaPulseAmp: 0.54,              // added alpha at the high point (peak = min + amp = 0.68; was 0.44); selected = steady halo at the same alpha
    // (looked at peak on tones 60/128/140/200: glyphs stay readable since the glow sits on its own canvas behind them)
    ppaPulseFps: 30,                // cap for pulse-only redraws when nothing else moves
    xrayK: 0.22,                    // x-ray glow: PPA surface hidden behind cortex (or facing away) glows at this fraction of the direct alpha, same pulse phase (peak ~0.15)
    xrayCov: [0.08, 0.45],          // x-ray glow: cell coverage by hidden PPA (3x3-blurred) mapped through a smoothstep over this range -> 0..1 (soft, diffuse edge)
    ppaFace: [0.2, 0.6],            // direct glow per cell = smoothstep of the mean surface facing (normal z) over this range
    ppaSoftP: [0.2, 0.8],           //   x smoothstep of the cell's visible PPA fraction over this range: a continuous function of the pose, so the blob dims as it turns
                                    //   away or slips behind cortex instead of popping cell by cell (core stays at full alpha; the cell test above still drives hover/hit/pointer)
    ppaVisW: [0.5, 14],             //   x linear ramp of the soft visible PPA weight (both sides, see ppaTrack) over this range: a patch emerging from behind a fold fades in over a few degrees
    xrayErase: 0.14,                // glyphs over the x-ray glow lose up to this much opacity (the brain looks a bit see-through there; nowhere else)
    glow: 0,                        // PPA glow look (not a user setting; Alex chose the stepped glow): 0 = stepped: exactly two flat levels in whole character blocks,
                                    // 1 where the PPA is seen, xrayK where it only shows through (cellX >= 0.5). Internal only: 1 = the older smooth field (smoothsteps,
                                    // 3x3 feather, bilinear), in between both are mixed; kept for comparison via __brain.setGlow(v), not exposed or stored.
    startPitchDeg: -25,             // start view: camera tilted this many degrees (negative = looking a bit from below), idle spin keeps it
    nodPitch: -0.85,                // idle "peek" nod: pitch offset (rad) to show the underside
    nodEvery: 14000,                // ms between idle nods until the PPA is found
    nodUpMs: 900, nodHoldMs: 300, nodDownMs: 5200,   // the nod is quick up (ease-out), a short hold, then a slow, viscous sink back (ease-in-out)
    introDelayMs: 2500,             // first-visit intro (ghost hand): the first hint (the PPA) comes this long after the brain is drawn, once the visitor has been still this long
    introIdleMs: 5000,              // the name hint on its own (the visitor found the PPA but not the name): after this long without input
    introGiveUpMs: 180000,          // no new hints after this long from the page load (not this visit; marked as seen only if a hint showed)
    introPpaMin: 8,                 // the PPA hint starts once at least this many PPA cells are in view (the brain keeps turning and nodding meanwhile)...
    introPpaWaitMs: 15000,          // ...waiting at most this long for that (a whole idle nod cycle); then the run goes on without it (name, box)
    introFollowMs: 90,              // the hand on the turning PPA: time constant of its light smoothing filter (ms)
    introRestMs: [1150, 1150, 1300],// the hand rests on the PPA, on the name, on a box (a hint only: nothing opens)
    introAlpha: 0.5,                // the ghost hand's opacity (faint: a hint, not the visitor's own pointer)
    introScale: 2.0,                // the ghost hand's size, relative to the system's pointing hand (twice: it may be larger than the real pointer)
    introFadeMs: 650,               // the hand fades in / out this slowly
    introBoxStillMs: 1500,          // the box hint: once rolled-up boxes are in view and the visitor has been still this long (no box open)
    stripsBelow: 900,               // viewport width (px) under which labels sit in strips above/below the brain instead of side gutters
    brainFrac: 0.72,                // desktop: brain width as a fraction of the available width
    maxBrainW: 660,                 // desktop: max brain width (css px)
    lblGap: 14,                     // desktop: gap (px) between the brain extent and a label
    lblMax: 250,                    // max label width (px) on desktop (narrower when the gutter is narrower; was 190: tall narrow boxes stacked badly)
    lblStackGap: 10,                // min vertical gap (px) between two label boxes in the same gutter, enforced on every frame (glides included)
    lblStripGap: 4,                 // the same for the strips above / below the brain on narrow screens (kept small: phones have no height to spare)
    lblEdge: 8,                     // keep labels this far inside the first screen when a gutter stack is taller than the brain
    smoothMs: 150,                  // label flow: time constant (ms) of the glide to the target slot
    ppaSwitch: 1.5,                 // PPA pointer: follows one hemisphere; switches only when the other side's visible weight is this many times larger
    ppaGlideMs: 400,                // PPA pointer: time constant (ms) of the glide from the old to the new hemisphere after a switch
    ppaGlidePxMs: 0.22,             // PPA pointer: speed cap (px/ms) of that glide, so a long switch slides calmly instead of rushing off
    ppaView: [295, -43],            // click on the PPA label: turn to this yaw/pitch (deg); found by a scan: left PPA pointer ~24 px from the view centre, left weight >= 0.69 x right (kept by the hysteresis)
    ppaOcclude: true,               // PPA pointer: ignore PPA vertices hidden behind other surface (z-buffer test)
    ppaFullW: 10,                   // PPA pointer: visible (facing, unoccluded) vertex weight at which the PPA label is fully opaque
    ppaHystP: 0.1, ppaHystZ: 0.06,  // PPA cell test hysteresis: a cell enters at P > 0.5 + hP and Z > 0.35 + hZ, stays while P > 0.5 - hP and Z > 0.35 - hZ
    sideHys: 0.15,                  // a label changes gutter only after its anchor is this fraction of the brain width past the centre
    orderHys: 14,                   // px an anchor must be out of order before two labels in a gutter swap
    crossMs: 300,                   // glide time constant (ms) while sliding across to the other gutter
    crossPxMs: 0.8,                 // max speed (px/ms) of the cross-over glide
    crossAlpha: 0.35,               // opacity multiplier while a label slides across to the other gutter
    glidePxMs: 0.5,                 // max speed (px/ms, ~8 px per 60 Hz frame) of a label gliding to its slot, e.g. making room for a newcomer
    snapPx: 0.3,                    // distance (px) under which a gliding label counts as settled
    charMs: 30,                     // typing speed (ms per character)
    lineMs: 700,                    // longest time one typed line takes
    pasteMs: 350,                   // how long the pasted line stays highlighted
    hotR: 24,                       // hover/tap radius (px) around a label anchor
    stickyPx: 120,                  // contact line: safe zone = name + contact rects expanded by this many px; hover stays 'on' while the mouse is inside
    centerMs: 1000,                 // click/tap on a bio label: ease-in-out rotation (ms) that brings its anchor to the front, centred in the view
    idleSpin: 0.00011,              // idle auto-rotation (rad/ms, yaw); half of the previous 0.00022
    spinResumeMs: 2500,             // after the visitor's own turning (drag, arrow keys) the idle spin waits this long, then eases in
    spinRampMs: 2500,               // each time the idle spin (re)starts (page load, after a drag, keys, a click...) its speed eases in from 0 over this long (smoothstep; the angle never jumps)
    lingerMs: 10000,                // mouse hover: labels + contact stay this long (ms) after the pointer leaves the safe zone (or the window); cancelled if it returns
                                    // the same time keeps an opened box ('my route there') open after the hover / focus ends, or after a click / tap
    openMs: 220, closeMs: 260,      // layout B: a box grows to show its route over openMs, shrinks back over closeMs (its neighbours glide aside / back)
    asideMs: 140, asideBackMs: 300, // phones (strips): while a box is open its strip neighbour fades out (asideMs) and comes back after it closes (asideBackMs)
    amyRas: [[-22.6, -4.9, -18.1], [23.0, -3.7, -18.1]],   // psychology dot: centres of the left / right amygdala, MNI mm (= 'c' in site/amygdala.json, Harvard-Oxford)
    amySwitchMm: 4,                 // the dot follows the nearer amygdala; it changes side when the other one is this many mm nearer to the viewer
    amyGlideMs: 600,                // ...and then glides through the brain to the other side over this time
    amyErase: 0.3,                  // while the psychology box is open, the nearer amygdala shows through (never in the PPA colour, never pulsing):
    amyRingErase: 0.85,             //   3D: glyphs over it lose this much opacity, and the cells on its edge lose amyRingErase and carry a line glyph (- | / \)
    amyRingA: 0.7,                  //   in the brain's own far-depth colour at amyRingA; contour mode: the same edge, dotted (line glyphs and middle dots
    amyLineA: 0.46,                 //   in turn) at amyLineA (about half the contour line opacity); a brain line under it gives way like the 3D glyphs
    fitMaxShrink: 0.08,             // small screens: the brain may shrink by up to this fraction so that name + contact fit in the first screen (rest is handled by scrolling the contact into view)
    fitMaxShrinkStrips: 0.25,       // phones (strips): up to this fraction, so that the whole page fits the first screen if it can, else at least the name does:
                                    // the strips are taller since the boxes show what each area does and keep room for one open box (decision page, phones option A)
    fitMarginPx: 6,                 // px kept free below the contact line when fitting
    // glitch (Alex, 2026-11-16): now and then the ASCII brain "glitches" into a photorealistic brain for a moment, like a TV, then snaps back.
    // The real brain is the same mesh (finer: fsaverage6, site/brain_hd.bin.gz) drawn with WebGL from the same view, so it matches the pose exactly.
    glitch: true,                   // false = never (the test harness turns it off unless a test asks for it); __brain.glitchNow() still works
    glitchFirstMs: [12000, 18000],  // the first one comes early (uniform in this range after the brain is drawn), so visitors notice it happens
    glitchGapMeanMs: 30000,         // then gaps from a normal distribution, mean 30 s, SD 10 s (Alex, 2026-11-16; one SD = 20..40 s)...
    glitchGapSdMs: 10000,
    glitchGapMinMs: 6000,           // ...redrawn (not clamped) while below this, so short gaps do not bunch up at the minimum (it cuts 0.8% of the normal: mean ~30.2 s, SD ~9.8 s)
    glitchDurMedianMs: 800,         // length of one glitch: two peaks (Alex, 2026-11-17: bimodal, more long ones). Most are short: lognormal, median 0.8 s,
    glitchDurSigma: 0.35,           //   sigma 0.35 ...
    glitchDurLongShare: 0.3,        // ... and this share is long: lognormal, median 2.4 s, sigma 0.2 (mostly 1.6-3.6 s), with a dip near 1.5 s between the peaks.
    glitchDurLongMedianMs: 2400,
    glitchDurLongSigma: 0.2,
    glitchDurMinMs: 450,            // every length clamped to [min, max]. Flickering bursts, not a crossfade
    glitchDurMaxMs: 4000,
    glitchRetryMs: 700,             // due while blocked (a drag, the intro hand, hidden tab; not an open box): try again this long later (so: right after it ends)
    glitchPrefetchMs: 6000,         // set-up starts this long before a glitch is due, in idle moments (context, parallel shader compile, the finer mesh ~270 KB, probe)
    glitchTiers: {                  // what each quality tier draws (see the glitch section): mesh, tissue shader, detail (1 = vessels and fine bumps), brain texture
      high: { mesh: 'fine', shader: 'full', detail: 1, scale: 0.7, dpr: 2, msaa: true, photo: true },      //   scale, max device px per css px, 4x MSAA (WebGL2),
      medium: { mesh: 'coarse', shader: 'full', detail: 0, scale: 0.5, dpr: 1.5, msaa: false, photo: true },   //   photo pass (blur, grain, fringe, vignette)
      low: { mesh: 'coarse', shader: 'lite', detail: 0, scale: 0.5, dpr: 1, msaa: false, photo: false }
    },
    glitchTier: {                   // how the tier is chosen (Alex, 2026-11-17: the lightest working tier still glitches; off only without WebGL or when extremely slow)
      softwareRe: /swiftshader|llvmpipe|softpipe|software|basic render/i,   // software renderer -> at best low
      memLow: 1, memMedium: 2,      // navigator.deviceMemory (GB) at or below -> at best low / medium
      coresMedium: 2,               // navigator.hardwareConcurrency at or below -> at best medium
      smallScreenPx: 480,           // shorter screen side below this (phones) -> at best medium (Save-Data or a 2G link: medium, and no fine-mesh download)
      asciiMediumMs: 6, asciiLowMs: 14,   // the ASCII brain's median render time (ms) above -> at best medium / low
      probeMs: [3, 10, 60],         // micro-benchmark (the low tier's brain draw, waited for, in an idle moment): at most 3 ms -> high, 10 -> medium, 60 -> low, else off
      slowFrameMs: 45,              // during a glitch: two frame intervals over this -> one tier lighter at once
      ttlMs: 7 * 24 * 3600 * 1000,  // the decided tier is stored with its time and reused for a week without new detection (live step-downs are saved too)
      fastFrameMs: 24, upAfter: 3   // this many glitches in a row with every frame under fastFrameMs -> one tier better (prepared in idle moments); ?tier=... forces one
    },
    glitchPpa: true,                // the photo frames keep the ASCII brain's PPA glow (the same cells, same alpha, torn with the frame); nothing else is tinted
    glitchFreeHiddenMs: 60000,      // a tab hidden this long gives its WebGL memory back (set up again before the next glitch)
    glitchViewMs: [1500, 3500],     // ?glitch=1 in the URL: first after 1.5 s, then every 3.5 s (for viewing)
    glitchMesh: 'brain_hd.bin.gz',
    glitchPhoto: { scale: 0.7, blur: 0.8, grain: 0.05, ca: 0.5, vignette: 0.18 }   // photo look: render scale of the brain, blur radius (css px), sensor grain, colour fringe (px), light fall-off
  };
  const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() || 'monospace';
  const FS = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs')) || 12;   // the one font size (css --fs), also for the canvas glyphs
  const PPA_LETTERS = 'PPA';
  let INK = '0,0,0', ACCENT = 'rgb(255,125,0)', HALO = 'rgba(255,125,0,.35)';
  const BANDS = [0.40, 0.52, 0.64];           // sulcal-depth contour levels
  const SX = 2, SY = 3;                     // samples per cell (x, y)
  let ASPECT = 2;                         // cell height / width
  const canvas = document.getElementById('brain'), ctx = canvas.getContext('2d');
  // PPA highlight lives on its own canvas behind the glyphs, so the slow breathing redraws only a few filled cells, never the whole brain
  const glow = document.createElement('canvas'), gctx = glow.getContext('2d'); glow.setAttribute('aria-hidden', 'true');
  glow.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none'; canvas.parentNode.insertBefore(glow, canvas);
  const info = document.getElementById('info'), hint = document.getElementById('hint');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEF = window.UI_DEFAULTS || { tone: 128, depth: 100 };
  const DEFB = DEF.bands >= 0 ? DEF.bands : 0;
  const snapB = v => (+v < 50 ? 0 : 100);   // the bands control has two states, the two ends: soft (0: 48 bins, the default) and stepped (100: 8 bins)
  let bands = DEFB; try { const bv = localStorage.getItem('bands'); if (/^\d{1,3}$/.test(bv || '') && +bv <= 100) bands = snapB(bv); } catch (e) {}   // a stored slider value (older visits) snaps to the nearer state
  let T = DEF.depth >= 50 ? 1 : 0; try { const dv = parseInt(localStorage.getItem('depth'), 10); if (dv >= 0 && dv <= 100) T = dv >= 50 ? 1 : 0; } catch (e) {}   // depth: 1 = full 3D, 0 = contour lines
  let tone = 128, n3 = 0, nC = 0, sw = 0, swT0 = 0, rect = null, strips = false, sceneLeft = 0, sceneTop = 0, vw = 1280, cellH = null;
  const NR = CFG.ramp.length - 1, SHADE = [];

  let M = null;                              // mesh
  let yaw = 0, pitch = CFG.startPitchDeg * Math.PI / 180, vYaw = 0, vPitch = 0, dirty = true, lastInteract = -1e9;
  let cols = 100, rows = 42, pad = 0, bb = null, cw = 8, ch = 16, dpr = 1;
  let cellPpa = null, cellKind = null, cellGlyph = null, cellCov = null, cellD = null, cellL = null, cellV = null, cellZ = null, cellB = null, cellBp = null, cellT = null, bKey = null, bOrd = null, bOff = new Int32Array(160), lastFills = [], DCOL = [], DCON = [], RAMP = [], ppaCount = 0, hoverPpa = false, found = false, infoUntil = 0, drawn = 0;
  let nod = 0, nodT0 = 0, nextNod = performance.now() + 5000, lastRot = null;
  const frames = [];

  async function loadMesh() {
    const r = await meshReq; let buf = await r.arrayBuffer();
    const b = new Uint8Array(buf);
    if (b[0] === 0x1f && b[1] === 0x8b) {    // still gzipped (host did not decompress)
      const ds = new DecompressionStream('gzip');
      buf = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
    }
    const dv = new DataView(buf), nv = dv.getUint32(0, true), nf = dv.getUint32(4, true);
    let o = 8; const q = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6;
    const cen = [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)], half = dv.getFloat32(o + 12, true); o += 16;
    const depth = new Uint8Array(buf, o, nv); o += nv;
    const ppa = new Uint8Array(buf, o, nv); o += nv;
    const idx = new Uint16Array(buf.slice(o, o + nf * 6));
    const pos = new Float32Array(nv * 3); for (let i = 0; i < nv * 3; i++) pos[i] = q[i] / 32767 * half;
    const nrm = new Float32Array(nv * 3);
    for (let f = 0; f < nf * 3; f += 3) {
      const a = idx[f] * 3, b2 = idx[f + 1] * 3, c = idx[f + 2] * 3;
      const ux = pos[b2] - pos[a], uy = pos[b2 + 1] - pos[a + 1], uz = pos[b2 + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz; nrm[b2] += nx; nrm[b2 + 1] += ny; nrm[b2 + 2] += nz; nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;   // same sums, same order (no array per face: 41k of them meant startup GC)
    }
    for (let i = 0; i < nv * 3; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1; nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; }
    let R2 = 0; for (let i = 0; i < nv * 3; i += 3) { const l = pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]; if (l > R2) R2 = l; }
    return { nv, nf, pos, nrm, idx, depth, ppa, half, cen, radius: Math.sqrt(R2) };
  }

  // ---- renderer ----
  let W = 0, H = 0, zb, ib, sl, sd, sp, sn, px, py, pz, vl, vn;
  // x-ray glow: xr = per sample, the strongest hidden PPA behind the front surface; cellX = per cell 0..1; glowF = per cell alpha factor (direct + x-ray), drawn via the cols x rows glowLo canvas
  let xr = null, cellXr = null, cellX = null, cellNz = null, cellPf = null, glowF = null, glowImg = null, PF = null, xrayN = 0;
  const glowLo = document.createElement('canvas');
  // amygdala layer (psychology box open): AMY = surfaces from site/amygdala.json in mesh space; per cell: amyE erase alpha, amyG edge glyph, amyGA its alpha; amyList = touched cells
  let AMY = null, amyM = null, amyCv = null, amyE = null, amyG = null, amyGA = null, amyP = new Float32Array(512), amyOn = false, amyT = 0, amyCalls = 0, amyCol = '';
  const amyList = [], amyMsA = [];
  function alloc() {
    W = cols * SX; H = rows * SY;
    zb = new Float32Array(W * H); sl = new Float32Array(W * H); sd = new Float32Array(W * H); sp = new Float32Array(W * H); sn = new Float32Array(W * H);
    cellPpa = new Uint8Array(cols * rows); cellKind = new Uint8Array(cols * rows); cellGlyph = new Uint8Array(cols * rows); cellCov = new Float32Array(cols * rows); cellD = new Float32Array(cols * rows); cellL = new Float32Array(cols * rows); cellV = new Uint8Array(cols * rows); cellZ = new Float32Array(cols * rows); cellB = new Uint8Array(cols * rows); cellBp = new Uint8Array(cols * rows).fill(255); cellT = new Uint8Array(cols * rows).fill(255); bKey = new Uint8Array(cols * rows); bOrd = new Int32Array(cols * rows);
    xr = new Float32Array(W * H); cellXr = new Float32Array(cols * rows); cellX = new Float32Array(cols * rows); glowF = new Float32Array(cols * rows); cellNz = new Float32Array(cols * rows); cellPf = new Float32Array(cols * rows);
    glowLo.width = cols; glowLo.height = rows; glowImg = glowLo.getContext('2d').createImageData(cols, rows); gx1 = -1; gSub = glowSubOk();
    cellH = new Float32Array(cols * rows); for (let i = 0; i < cellH.length; i++) { const h = Math.sin(i * 12.9898) * 43758.5453; cellH[i] = h - Math.floor(h); }
    amyM = new Uint8Array(W * H); amyCv = new Float32Array(cols * rows); amyE = new Float32Array(cols * rows); amyG = new Uint8Array(cols * rows); amyGA = new Float32Array(cols * rows); amyList.length = 0;
  }
  const rotation = () => rotYP(yaw + sw, pitch + nod);
  function rotYP(yw, pt) {   // camera = Rx(pitch) * Ry(yaw) * B ; B: brain RAS -> left-lateral view (anterior to the left)
    const cy = Math.cos(yw), sy = Math.sin(yw), cp = Math.cos(pt), sP = Math.sin(pt);
    const B = [[0, -1, 0], [0, 0, 1], [-1, 0, 0]], Ry = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Rx = [[1, 0, 0], [0, cp, -sP], [0, sP, cp]];
    const mul = (A, C) => A.map(r => [0, 1, 2].map(j => r[0] * C[0][j] + r[1] * C[1][j] + r[2] * C[2][j]));
    return mul(Rx, mul(Ry, B));
  }
  let hystB = CFG.depthHyst;   // bin hysteresis for the current bin count (setBins)
  function depthPos(z) {   // continuous position in bins, clamped to [0, NB)
    const R = M ? M.radius : 91, lo = CFG.depthLoR * R, hi = CFG.depthHiR * R, NB = CFG.depthBins;
    const p = (z - lo) / (hi - lo) * NB; return p < 0 ? 0 : p > NB - 1e-6 ? NB - 1e-6 : p;
  }
  function cellBinHyst(ci, z) {
    const p = depthPos(z), b0 = cellBp[ci], h = hystB;
    const b = (b0 !== 255 && p >= b0 - h && p <= b0 + 1 + h) ? b0 : Math.floor(p);
    cellBp[ci] = b; return b;
  }
  function render() {
    const t0 = performance.now();
    const R = rotation(), m = M; lastRot = R;                 // lastRot: the pose of the ASCII frame (the glitch draws the same one)
    const scale = cols * 0.96 / 182;                           // cells per mm
    const kx = scale * SX, ky = scale * SY / ASPECT, ox = W / 2, oy = H / 2;
    const Lx = -0.4, Ly = 0.5, Lz = 0.77;
    if (!px) { px = new Float32Array(m.nv); py = new Float32Array(m.nv); pz = new Float32Array(m.nv); vl = new Float32Array(m.nv); vn = new Float32Array(m.nv); }
    for (let i = 0, j = 0; i < m.nv; i++, j += 3) {
      const x = m.pos[j], y = m.pos[j + 1], z = m.pos[j + 2];
      px[i] = ox + (R[0][0] * x + R[0][1] * y + R[0][2] * z) * kx;
      py[i] = oy - (R[1][0] * x + R[1][1] * y + R[1][2] * z) * ky;
      pz[i] = R[2][0] * x + R[2][1] * y + R[2][2] * z;
      const nx = m.nrm[j], ny = m.nrm[j + 1], nz = m.nrm[j + 2];
      const cx = R[0][0] * nx + R[0][1] * ny + R[0][2] * nz, cyy = R[1][0] * nx + R[1][1] * ny + R[1][2] * nz, cz = R[2][0] * nx + R[2][1] * ny + R[2][2] * nz;
      const d = cx * Lx + cyy * Ly + cz * Lz; vl[i] = d > 0 ? d : 0; vn[i] = cz;
    }
    zb.fill(-1e9); sn.fill(-2);
    const idx = m.idx, dep = m.depth, ppa = m.ppa;
    for (let f = 0, t = 0; f < m.nf; f++, t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const x0 = px[a], y0 = py[a], x1 = px[b], y1 = py[b], x2 = px[c], y2 = py[c];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (area >= 0) continue;
      const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(W - 1, Math.floor(Math.max(x0, x1, x2) - 0.5));
      const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(H - 1, Math.floor(Math.max(y0, y1, y2) - 0.5));
      if (minX > maxX || minY > maxY) continue;
      const z0 = pz[a], z1 = pz[b], z2 = pz[c], inv = 1 / area;
      const l0 = vl[a], l1 = vl[b], l2 = vl[c], d0 = dep[a], d1 = dep[b], d2 = dep[c], p0 = ppa[a], p1 = ppa[b], p2 = ppa[c], n0 = vn[a], n1 = vn[b], n2 = vn[c];
      for (let yy = minY; yy <= maxY; yy++) {
        const sY = yy + 0.5;
        for (let xx = minX; xx <= maxX; xx++) {
          const sX = xx + 0.5;
          const w0 = ((x1 - sX) * (y2 - sY) - (x2 - sX) * (y1 - sY)) * inv;
          const w1 = ((x2 - sX) * (y0 - sY) - (x0 - sX) * (y2 - sY)) * inv;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * z0 + w1 * z1 + w2 * z2, k = yy * W + xx;
          if (z > zb[k]) { zb[k] = z; sl[k] = w0 * l0 + w1 * l1 + w2 * l2; sd[k] = (w0 * d0 + w1 * d1 + w2 * d2) / 255; sp[k] = w0 * p0 + w1 * p1 + w2 * p2; sn[k] = w0 * n0 + w1 * n1 + w2 * n2; }
        }
      }
    }
    // aggregate to cells
    const tot = SX * SY; ppaCount = 0; let mnC = 1e9, mxC = -1, mnR = 1e9, mxR = -1, zLo = 1e9, zHi = -1e9;
    for (let yc = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++) {
      let cov = 0, D = 0, P = 0, Z = 0, L = 0, ZD = 0;
      for (let sy = 0; sy < SY; sy++) { let k = (yc * SY + sy) * W + xc * SX; for (let sx = 0; sx < SX; sx++, k++) if (sn[k] > -2) { cov++; ZD += zb[k]; L += sl[k]; D += sd[k]; P += sp[k]; Z += sn[k]; } }
      const ci = yc * cols + xc;
      cellCov[ci] = cov / tot;
      if (cov < 2) { cellD[ci] = -1; cellPpa[ci] = 0; cellPf[ci] = 0; cellV[ci] = 0; cellBp[ci] = 255; cellT[ci] = 255; continue; }
      cellD[ci] = D / cov; Z /= cov; cellL[ci] = L / cov; ZD /= cov; cellZ[ci] = ZD; if (ZD < zLo) zLo = ZD; if (ZD > zHi) zHi = ZD;
      if (xc < mnC) mnC = xc; if (xc > mxC) mxC = xc; if (yc < mnR) mnR = yc; if (yc > mxR) mxR = yc;
      {
        const dd = Math.max(0, (D / cov - CFG.depthCut) / (1 - CFG.depthCut));
        let v = (0.18 + 0.82 * cellL[ci]) - CFG.depthK * dd;
        v *= Math.sqrt(cov / tot);
        v = Math.pow(Math.max(0, Math.min(1, (v - 0.5) * CFG.contrast + 0.5)), CFG.gamma);
        v *= 0.4 + 0.6 * T;                                    // glyphs move down the ramp as depth falls
        cellV[ci] = v < CFG.vMin ? 0 : Math.min(NR, 1 + Math.floor(v * NR));
        if (CFG.depthColor) {   // opacity tier with hysteresis, in glyph-index space (same 3 bands of the ramp as before)
          if (cellV[ci] === 0) cellT[ci] = 255;
          else {
            const q = (cellV[ci] - 1) * 3 / NR, tp = cellT[ci], h = CFG.depthHyst;
            cellT[ci] = (tp !== 255 && q >= tp - h && q <= tp + 1 + h) ? tp : Math.max(0, Math.min(2, Math.floor(q)));
          }
        }
      }
      const hP = cellPpa[ci] ? -CFG.ppaHystP : CFG.ppaHystP, hZ = cellPpa[ci] ? -CFG.ppaHystZ : CFG.ppaHystZ;   // hysteresis: stops edge cells of the orange blob from flickering
      const isP = P / cov > 0.5 + hP && Z > 0.35 + hZ ? 1 : 0; cellPpa[ci] = isP; ppaCount += isP; cellNz[ci] = Z; cellPf[ci] = P / cov;
    }
    xray();
    if (CFG.depthColor) {   // depth bin per covered cell: 0 = farthest ... NB-1 = nearest (z grows towards the viewer); fixed rotation-invariant range, per-cell hysteresis
      for (let ci = 0; ci < cellB.length; ci++) if (cellD[ci] >= 0) cellB[ci] = cellBinHyst(ci, cellZ[ci]);
    }
    bb = mxC < 0 ? null : { c0: mnC, r0: mnR, c1: mxC, r1: mxR };
    rect = mxC < 0 ? null : { x0: mnC * cw, y0: (mnR - pad) * ch, x1: (mxC + 1) * cw, y1: (mxR + 1 - pad) * ch };   // scene coordinates (the canvas starts pad rows above the scene)
    if (T < 1) contours();
    amyOn = !!(AMY && PSY_L.shown && PSY_L.oa > 0);
    if (amyOn || amyList.length) amyLayer(R);   // nothing at all while the psychology box is closed
    draw();
    if (amyOn) { amyMsA.push(amyT); if (amyMsA.length > 60) amyMsA.shift(); }
    placeLabels(R);
    buildGlow(); drawGlow();   // after placeLabels: ppaTrack has this frame's visible PPA weight
    frames.push(performance.now() - t0); if (frames.length > 90) frames.shift();
  }
  // x-ray: rasterise only the PPA triangles again, both orientations, without writing the z-buffer. A sample counts as "seen through the brain"
  // by how much it is hidden: soft occlusion over 1..4 mm behind the front surface, or (when it is the front surface) by how little it faces the viewer.
  // So the direct blob (front, facing) gives ~0 here and the x-ray takes over continuously as the PPA turns away or goes behind other cortex.
  function xray() {
    const m = M, idx = m.idx, ppa = m.ppa;
    if (!PF) { const f = []; for (let i = 0; i < m.nf; i++) if (ppa[idx[i * 3]] || ppa[idx[i * 3 + 1]] || ppa[idx[i * 3 + 2]]) f.push(i); PF = Int32Array.from(f); }
    xr.fill(0);
    for (let q = 0; q < PF.length; q++) {
      const t = PF[q] * 3, a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const x0 = px[a], y0 = py[a], x1 = px[b], y1 = py[b], x2 = px[c], y2 = py[c];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (area === 0) continue;
      const minX = Math.max(0, Math.ceil(Math.min(x0, x1, x2) - 0.5)), maxX = Math.min(W - 1, Math.floor(Math.max(x0, x1, x2) - 0.5));
      const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2) - 0.5)), maxY = Math.min(H - 1, Math.floor(Math.max(y0, y1, y2) - 0.5));
      if (minX > maxX || minY > maxY) continue;
      const inv = 1 / area, z0 = pz[a], z1 = pz[b], z2 = pz[c], p0 = ppa[a], p1 = ppa[b], p2 = ppa[c], n0 = vn[a], n1 = vn[b], n2 = vn[c];
      for (let yy = minY; yy <= maxY; yy++) {
        const sY = yy + 0.5;
        for (let xx = minX; xx <= maxX; xx++) {
          const sX = xx + 0.5;
          const w0 = ((x1 - sX) * (y2 - sY) - (x2 - sX) * (y1 - sY)) * inv, w1 = ((x2 - sX) * (y0 - sY) - (x0 - sX) * (y2 - sY)) * inv, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const k = yy * W + xx, p = w0 * p0 + w1 * p1 + w2 * p2; if (p <= xr[k]) continue;
          const d = zb[k] - (w0 * z0 + w1 * z1 + w2 * z2), occ = d <= 1 ? 0 : d >= 4 ? 1 : (d - 1) / 3;
          const v = p * (1 - (1 - occ) * smooth01((w0 * n0 + w1 * n1 + w2 * n2 - 0.2) / 0.3));
          if (v > xr[k]) xr[k] = v;
        }
      }
    }
    const tot = SX * SY;
    for (let yc = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++) {
      let s = 0; for (let sy = 0; sy < SY; sy++) { let k = (yc * SY + sy) * W + xc * SX; for (let sx = 0; sx < SX; sx++, k++) s += xr[k]; }
      cellXr[yc * cols + xc] = s / tot;
    }
    const [lo, hi] = CFG.xrayCov; xrayN = 0;
    for (let yc = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++) {   // 3x3 blur (centre 4, edges 2, corners 1): diffuse, "seen through" look
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) { const y = yc + dy; if (y < 0 || y >= rows) continue; for (let dx = -1; dx <= 1; dx++) { const x = xc + dx; if (x < 0 || x >= cols) continue; s += (2 - Math.abs(dx)) * (2 - Math.abs(dy)) * cellXr[y * cols + x]; } }
      const v = smooth01((s / 16 - lo) / (hi - lo)); cellX[yc * cols + xc] = v; if (v > 0.02) xrayN++;
    }
  }
  // the nearer amygdala, shown through the brain while the psychology box is open: rasterise its ~200 triangles (both orientations, no depth test:
  // it is always inside) into a sample mask, cell coverage = fraction of samples; cells >= half covered are inside, the inside cells with an outside
  // neighbour are its edge. The two sides cross-fade while the dot glides from one amygdala to the other. Never on cells of the PPA glow.
  function amyLayer(R) {
    const t0 = performance.now();
    for (const ci of amyList) { amyE[ci] = 0; amyG[ci] = 0; amyGA[ci] = 0; } amyList.length = 0;
    if (!amyOn) { amyT = 0; return; }
    amyCalls++;
    const A = smooth01(PSY_L.oa), e = smooth01(amyS), sc = cols * 0.96 / 182, kx = sc * SX, ky = sc * SY / ASPECT, ox = W / 2, oy = H / 2, tot = SX * SY, d3 = T >= 0.5;
    for (let s = 0; s < 2; s++) {
      const w = (s ? e : 1 - e) * A; if (w < 0.01) continue;
      const v = AMY[s].v, f = AMY[s].f, n = v.length / 3; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        const X = ox + (R[0][0] * v[j] + R[0][1] * v[j + 1] + R[0][2] * v[j + 2]) * kx, Y = oy - (R[1][0] * v[j] + R[1][1] * v[j + 1] + R[1][2] * v[j + 2]) * ky;
        amyP[2 * i] = X; amyP[2 * i + 1] = Y; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
      const c0 = Math.max(0, Math.floor(x0 / SX) - 1), c1 = Math.min(cols - 1, Math.floor(x1 / SX) + 1), r0 = Math.max(0, Math.floor(y0 / SY) - 1), r1 = Math.min(rows - 1, Math.floor(y1 / SY) + 1);
      if (c0 > c1 || r0 > r1) continue;
      for (let yy = r0 * SY; yy < (r1 + 1) * SY; yy++) amyM.fill(0, yy * W + c0 * SX, yy * W + (c1 + 1) * SX);
      for (let t = 0; t < f.length; t += 3) {
        const a = f[t] * 2, b = f[t + 1] * 2, c = f[t + 2] * 2, X0 = amyP[a], Y0 = amyP[a + 1], X1 = amyP[b], Y1 = amyP[b + 1], X2 = amyP[c], Y2 = amyP[c + 1];
        const area = (X1 - X0) * (Y2 - Y0) - (X2 - X0) * (Y1 - Y0); if (area === 0) continue;
        const mnX = Math.max(0, Math.ceil(Math.min(X0, X1, X2) - 0.5)), mxX = Math.min(W - 1, Math.floor(Math.max(X0, X1, X2) - 0.5));
        const mnY = Math.max(0, Math.ceil(Math.min(Y0, Y1, Y2) - 0.5)), mxY = Math.min(H - 1, Math.floor(Math.max(Y0, Y1, Y2) - 0.5)), inv = 1 / area;
        for (let yy = mnY; yy <= mxY; yy++) { const sY = yy + 0.5; for (let xx = mnX; xx <= mxX; xx++) { const sX = xx + 0.5;
          const w0 = ((X1 - sX) * (Y2 - sY) - (X2 - sX) * (Y1 - sY)) * inv, w1 = ((X2 - sX) * (Y0 - sY) - (X0 - sX) * (Y2 - sY)) * inv;
          if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) amyM[yy * W + xx] = 1; } }
      }
      for (let yc = r0; yc <= r1; yc++) for (let xc = c0; xc <= c1; xc++) {
        let k = 0; for (let sy = 0; sy < SY; sy++) { const o = (yc * SY + sy) * W + xc * SX; for (let sx = 0; sx < SX; sx++) k += amyM[o + sx]; }
        amyCv[yc * cols + xc] = k / tot;
      }
      const cv = (x, y) => x < c0 || x > c1 || y < r0 || y > r1 ? 0 : amyCv[y * cols + x];
      for (let yc = r0; yc <= r1; yc++) for (let xc = c0; xc <= c1; xc++) {
        const ci = yc * cols + xc; if (amyCv[ci] < 0.5 || cellPpa[ci] || cellX[ci] >= 0.5) continue;   // outside, or a cell of the PPA glow (seen or seen through)
        const edge = cv(xc - 1, yc) < 0.5 || cv(xc + 1, yc) < 0.5 || cv(xc, yc - 1) < 0.5 || cv(xc, yc + 1) < 0.5;
        if (!d3 && !edge) continue;   // contour mode: a dotted outline only (over a brain line, that line gives way: amyRingErase)
        if (!amyE[ci] && !amyG[ci]) amyList.push(ci);
        if (d3 || cellKind[ci]) amyE[ci] = Math.max(amyE[ci], w * (edge ? CFG.amyRingErase : CFG.amyErase));
        if (edge) { amyG[ci] = !d3 && ((xc + yc) & 1) ? 183 : lineGlyph(cv(xc + 1, yc) - cv(xc - 1, yc), cv(xc, yc + 1) - cv(xc, yc - 1)); amyGA[ci] = Math.max(amyGA[ci], w * (d3 ? CFG.amyRingA : CFG.amyLineA)); }   // 183 = middle dot
      }
    }
    amyCol = 'rgb(' + (CFG.depthColor && RAMP.length ? RAMP[0] : INK) + ')';   // the brain's own far-depth colour
    amyT = performance.now() - t0;
  }
  const band = d => d < BANDS[0] ? 0 : d < BANDS[1] ? 1 : d < BANDS[2] ? 2 : 3;
  function lineGlyph(gx, gy) {   // line runs perpendicular to the gradient; cells are 1:ASPECT, so use physical units
    const dx = -gy / ASPECT, dy = gx, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ay < 0.4 * ax) return 45;                 // -
    if (ax < 0.4 * ay) return 124;                // |
    return dx * dy > 0 ? 92 : 47;                 // \ or /
  }
  function contours() {
    const get = (F, x, y, own) => (x < 0 || y < 0 || x >= cols || y >= rows) ? own : (F === cellD && cellD[y * cols + x] < 0 ? own : F[y * cols + x]);
    for (let yc = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++) {
      const ci = yc * cols + xc, d = cellD[ci];
      if (d < 0) { cellKind[ci] = 0; continue; }
      const cov = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows) ? 0 : (cellD[y * cols + x] < 0 ? 0 : 1);
      const edge = !(cov(xc - 1, yc) && cov(xc + 1, yc) && cov(xc, yc - 1) && cov(xc, yc + 1));
      if (edge) {
        const gx = get(cellCov, xc + 1, yc, 0) - get(cellCov, xc - 1, yc, 0), gy = get(cellCov, xc, yc + 1, 0) - get(cellCov, xc, yc - 1, 0);
        cellKind[ci] = 1; cellGlyph[ci] = lineGlyph(gx, gy); continue;
      }
      const b = band(d);
      const deeper = b > band(get(cellD, xc - 1, yc, d)) || b > band(get(cellD, xc + 1, yc, d)) || b > band(get(cellD, xc, yc - 1, d)) || b > band(get(cellD, xc, yc + 1, d));
      if (deeper) {
        const gx = get(cellD, xc + 1, yc, d) - get(cellD, xc - 1, yc, d), gy = get(cellD, xc, yc + 1, d) - get(cellD, xc, yc - 1, d);
        cellKind[ci] = 2; cellGlyph[ci] = lineGlyph(gx, gy);
      } else if (b >= 3) { cellKind[ci] = 3; cellGlyph[ci] = 46; }
      else cellKind[ci] = 0;
    }
  }
  let ppaAlpha = 0, lastPulse = 0;
  const wave = () => 0.5 - 0.5 * Math.cos(2 * Math.PI * performance.now() / CFG.ppaPulseMs);   // smooth 0..1..0
  const pulsing = () => !hoverPpa && ppaCount > 0;   // always breathing while the PPA is not selected
  function bucket(n, nk) {   // counting sort of cell indices by bKey (255 = skip) into bOrd; bOff[key]..bOff[key+1] is the slice of one key
    bOff.fill(0, 0, nk + 2);
    for (let i = 0; i < n; i++) { const k = bKey[i]; if (k !== 255) bOff[k + 1]++; }
    for (let k = 0; k < nk; k++) bOff[k + 1] += bOff[k];
    for (let i = 0; i < n; i++) { const k = bKey[i]; if (k !== 255) bOrd[bOff[k]++] = i; }
    for (let k = nk; k > 0; k--) bOff[k] = bOff[k - 1]; bOff[0] = 0;
  }
  const breathing = () => !hoverPpa && (ppaCount > 0 || xrayN > 0);   // the glow canvas breathes while either layer shows (pulsing() stays the direct-blob test)
  let xrayMax = 0, dirMax = 0, xrayA = 0;
  function buildGlow() {   // per render: alpha factor per cell = max(direct blob cell dimmed by how much it faces away, x-ray), written to the cols x rows image
    const k = CFG.xrayK, [f0, f1] = CFG.ppaFace, [q0, q1] = CFG.ppaSoftP, [v0, v1] = CFG.ppaVisW, Wv = ppaLast ? ppaLast[0].w + ppaLast[1].w : 0, wS = clamp((Wv - v0) / (v1 - v0), 0, 1), a = (ACCENT.match(/\d+/g) || [255, 125, 0]).map(Number), d = glowImg.data; xrayMax = dirMax = 0;
    const sg = glowSoftness(), raw = cellXr;   // (scratch: x-ray coverage is already folded into cellX) raw direct value per cell
    gx0 = gy0 = 1e9; gx1 = gy1 = -1;
    for (let i = 0; i < raw.length; i++) raw[i] = cellPf[i] > q0 ? smooth01((cellPf[i] - q0) / (q1 - q0)) * smooth01((cellNz[i] - f0) / (f1 - f0)) * wS : 0;
    for (let yc = 0, i = 0, j = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++, i++, j += 4) {
      let dv = 0;   // 3x3 feather (4/2/1, /16): a uniform core keeps its value, the rim gets in-between steps, a cell crossing the threshold moves its neighbours a little at a time
      for (let dy = -1; dy <= 1; dy++) { const y = yc + dy; if (y < 0 || y >= rows) continue; for (let dx = -1; dx <= 1; dx++) { const x = xc + dx; if (x >= 0 && x < cols) dv += (2 - Math.abs(dx)) * (2 - Math.abs(dy)) * raw[y * cols + x]; } }
      dv /= 16; const x = k * cellX[i]; let f = dv > x ? dv : x;
      if (sg < 1) f = sg * f + (1 - sg) * (cellPpa[i] ? 1 : cellX[i] >= 0.5 ? k : 0);   // stepped: seen = 1, x-ray only = xrayK, nothing in between
      glowF[i] = f;
      if (dv > dirMax) dirMax = dv; if (x > dv && x > xrayMax) xrayMax = x;
      d[j] = a[0]; d[j + 1] = a[1]; d[j + 2] = a[2]; d[j + 3] = Math.round(f * 255);
      if (d[j + 3]) { if (xc < gx0) gx0 = xc; if (xc > gx1) gx1 = xc; if (yc < gy0) gy0 = yc; if (yc > gy1) gy1 = yc; }   // extent of the lit cells
    }
    glowLo.getContext('2d').putImageData(glowImg, 0, 0);
  }
  // The stepped glow is drawn as the lit cells' bounding box (plus a transparent cell each side), not as the whole cols x rows image scaled over
  // the canvas: most of the canvas is transparent glow, and a software canvas (no GPU) spent ~9 ms per frame at 4x CPU, 2x pixels on that full-size
  // draw. Nearest-neighbour sampling maps each pixel to the same cell either way, as long as no pixel centre sits (almost) on a cell edge, where
  // rounding in the two mappings could differ: glowSubOk checks that at layout (true for 1x, 1.5x, 2x pixels); otherwise the whole image is drawn.
  let gx0 = 0, gx1 = -1, gy0 = 0, gy1 = -1, gSub = false, gSubOff = false;   // gSubOff: test hook glowBox(false) draws the whole image
  function glowSubOk() {
    const far = (step, n) => { for (let k = 0; k <= n; k++) { const v = k * step * dpr; if (Math.abs(v - Math.floor(v) - 0.5) < 1 / 2048) return false; } return true; };
    return far(cw, cols) && far(ch, rows);
  }
  const glowSoftness = () => { const v = +CFG.glow; return v >= 0 && v <= 1 ? v : 0; };   // 0 = stepped (two flat levels, blocks) .. 1 = smooth (feathered); internal
  function drawGlow() {
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0); gctx.clearRect(0, 0, cols * cw, rows * ch); ppaAlpha = 0; xrayA = 0;
    if (!hoverPpa && !breathing()) return;
    const A = hoverPpa || reduced ? CFG.ppaPulseMin + CFG.ppaPulseAmp : CFG.ppaPulseMin + CFG.ppaPulseAmp * (pulseFix === null ? wave() : pulseFix);   // selected / reduced motion: steady, equal to the pulse peak
    ppaAlpha = ppaCount > 0 ? A : 0; xrayA = A * xrayMax;   // ppaAlpha: the direct blob's core alpha (pulse value); xrayA: strongest x-ray-only alpha
    const s = glowSoftness(), W_ = cols * cw, H_ = rows * ch; gctx.imageSmoothingQuality = 'low';
    if (s < 1) {
      gctx.globalAlpha = A * (1 - s); gctx.imageSmoothingEnabled = false;
      if (s === 0 && gSub && !gSubOff) { if (gx1 >= 0) { const x0 = Math.max(0, gx0 - 1), x1 = Math.min(cols - 1, gx1 + 1), y0 = Math.max(0, gy0 - 1), y1 = Math.min(rows - 1, gy1 + 1), w = x1 - x0 + 1, h = y1 - y0 + 1; gctx.drawImage(glowLo, x0, y0, w, h, x0 * cw, y0 * ch, w * cw, h * ch); } }   // lit cells only (see glowSubOk)
      else gctx.drawImage(glowLo, 0, 0, cols, rows, 0, 0, W_, H_);
    }
    if (s > 0) { gctx.globalAlpha = A * s; gctx.imageSmoothingEnabled = true; if (s < 1) gctx.globalCompositeOperation = 'lighter'; gctx.drawImage(glowLo, 0, 0, cols, rows, 0, 0, W_, H_); }   // 'lighter' adds the two layers: an exact cross-fade (same colour)
    gctx.globalAlpha = 1; gctx.globalCompositeOperation = 'source-over';
  }
  let pulseFix = null;   // test hook: freeze the breath at a phase 0..1
  const glowAlphaNow = () => (!hoverPpa && !breathing()) ? 0 : hoverPpa || reduced ? CFG.ppaPulseMin + CFG.ppaPulseAmp : CFG.ppaPulseMin + CFG.ppaPulseAmp * (pulseFix === null ? wave() : pulseFix);   // the glow canvas's alpha now (as drawGlow; the photo glitch draws the same cells)
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cols * cw, rows * ch);
    const px_ = ' ' + FS + 'px ' + FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; drawn = 0;
    ctx.font = CFG.weight + px_;
    const n = cols * rows;
    n3 = 0; nC = 0;
    lastFills.length = 0;
    const dc = CFG.depthColor && DCOL.length > 0;
    if (T > 0) {
      if (dc) {
        for (let ci = 0; ci < n; ci++) {
          const v = cellV[ci];
          bKey[ci] = (v === 0 || (hoverPpa && cellPpa[ci]) || (T < 1 && cellKind[ci] > 0 && cellH[ci] >= T)) ? 255 : cellB[ci] * 3 + cellT[ci];
        }
        bucket(n, CFG.depthBins * 3);
        for (let key = 0, nk = CFG.depthBins * 3; key < nk; key++) {
          const a = bOff[key], e = bOff[key + 1]; if (a === e) continue;
          ctx.fillStyle = DCOL[key]; lastFills.push(DCOL[key]);
          for (let j = a; j < e; j++) { const ci = bOrd[j]; ctx.fillText(CFG.ramp[cellV[ci]], ((ci % cols) + 0.5) * cw, (Math.floor(ci / cols) + 0.5) * ch + 1); drawn++; n3++; }
        }
      } else for (let k = 1; k <= NR; k++) {
        ctx.fillStyle = SHADE[k]; const g = CFG.ramp[k]; lastFills.push(SHADE[k]);
        for (let ci = 0; ci < n; ci++) {
          if (cellV[ci] !== k || (hoverPpa && cellPpa[ci])) continue;
          if (T < 1 && cellKind[ci] > 0 && cellH[ci] >= T) continue;     // this cell shows its contour glyph instead
          ctx.fillText(g, ((ci % cols) + 0.5) * cw, (Math.floor(ci / cols) + 0.5) * ch + 1); drawn++; n3++;
        }
      }
    }
    if (T < 1) {
      if (dc) {
        for (let ci = 0; ci < n; ci++) bKey[ci] = (cellKind[ci] === 0 || cellH[ci] < T || (hoverPpa && cellPpa[ci])) ? 255 : cellB[ci] * 3 + cellKind[ci] - 1;
        bucket(n, CFG.depthBins * 3);
        for (let key = 0, nk = CFG.depthBins * 3; key < nk; key++) {
          const a = bOff[key], e = bOff[key + 1]; if (a === e) continue;
          ctx.fillStyle = DCON[key]; lastFills.push(DCON[key]);
          for (let j = a; j < e; j++) { const ci = bOrd[j]; ctx.fillText(String.fromCharCode(cellGlyph[ci]), ((ci % cols) + 0.5) * cw, (Math.floor(ci / cols) + 0.5) * ch + 1); drawn++; nC++; }
        }
      } else for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = 'rgba(' + INK + ',' + CFG.contourAlpha[k] * (0.35 + 0.65 * (1 - T)) + ')'; lastFills.push(ctx.fillStyle);
        for (let ci = 0; ci < n; ci++) {
          if (cellKind[ci] !== k || cellH[ci] < T || (hoverPpa && cellPpa[ci])) continue;
          ctx.fillText(String.fromCharCode(cellGlyph[ci]), ((ci % cols) + 0.5) * cw, (Math.floor(ci / cols) + 0.5) * ch + 1); drawn++; nC++;
        }
      }
    }
    if (xrayN && CFG.xrayErase > 0) {   // glyphs in front of the x-ray glow get slightly see-through (only there; the direct blob and the rest stay as they are)
      // per-cell rects (at <= 14% the steps do not show); a scaled drawImage onto the glyph canvas stalled the page for up to 1.6 s now and then (swiftshader)
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (let i = 0; i < n; i++) if (cellX[i] > 0.02 && !cellPpa[i]) { ctx.globalAlpha = CFG.xrayErase * cellX[i]; ctx.fillRect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    if (amyList.length) {   // the amygdala layer (amyLayer): see-through over it, then its edge glyphs
      const ta = performance.now();
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      for (const ci of amyList) if (amyE[ci] > 0) { ctx.globalAlpha = amyE[ci]; ctx.fillRect((ci % cols) * cw, Math.floor(ci / cols) * ch, cw, ch); }
      ctx.globalCompositeOperation = 'source-over'; ctx.font = CFG.weight + px_; ctx.fillStyle = amyCol; lastFills.push(amyCol);
      for (const ci of amyList) if (amyG[ci]) { ctx.globalAlpha = amyGA[ci]; ctx.fillText(String.fromCharCode(amyG[ci]), ((ci % cols) + 0.5) * cw, (Math.floor(ci / cols) + 0.5) * ch + 1); drawn++; }
      ctx.globalAlpha = 1; amyT += performance.now() - ta;
    }
    if (hoverPpa) {
      ctx.font = '800' + px_; ctx.fillStyle = ACCENT;
      for (let i = 0; i < n; i++) if (cellPpa[i]) { const xc = i % cols, yc = Math.floor(i / cols); ctx.fillText(PPA_LETTERS[(xc + yc) % 3], (xc + 0.5) * cw, (yc + 0.5) * ch + 1); drawn++; }
    }
  }
  function ppaCell() {   // visible PPA cell nearest to the centroid of the visible PPA cells, or -1
    let sx = 0, sy = 0, c = 0;
    for (let i = 0; i < cellPpa.length; i++) if (cellPpa[i]) { sx += i % cols; sy += Math.floor(i / cols); c++; }
    if (!c) return -1; sx /= c; sy /= c; let bi = -1, bd = 1e9;
    for (let i = 0; i < cellPpa.length; i++) if (cellPpa[i]) { const d = Math.hypot(i % cols - sx, Math.floor(i / cols) - sy); if (d < bd) { bd = d; bi = i; } }
    return bi;
  }

  // ---- tone + depth ----
  const toneEl = document.getElementById('tone'), depthEl = document.getElementById('depth'), depthBtns = depthEl.querySelectorAll('button[role=radio]'), rgbEl = document.getElementById('rgb');
  const p3 = n => String(n).padStart(3, '0');
  function shades() { const k = Math.sqrt(T); for (let i = 0; i <= NR; i++) SHADE[i] = 'rgba(' + INK + ',' + (CFG.shadeMin + (1 - CFG.shadeMin) * i / NR) * k + ')';
    RAMP = window.depthRamp(tone, CFG.depthBins, CFG.depthTier[0]); DCOL.length = 0; DCON.length = 0;
    for (let b = 0; b < CFG.depthBins; b++) for (let t = 0; t < 3; t++) {
      DCOL.push('rgba(' + RAMP[b] + ',' + CFG.depthTier[t] * k + ')');
      DCON.push('rgba(' + RAMP[b] + ',' + CFG.contourAlpha[t + 1] * (0.35 + 0.65 * (1 - T)) + ')');
    }
  }
  const resetEl = document.getElementById('reset'), palEl = document.getElementById('pal'), DEFPAL = DEF.palette || 'blue';
  const ybEl = document.getElementById('hyb'), grEl = document.getElementById('hgr'), bandsEl = document.getElementById('bands'), bandBtns = bandsEl ? [...bandsEl.querySelectorAll('button[role=radio]')] : [], moreEl = document.getElementById('more'), colEl = document.getElementById('col');
  const DEFYB = DEF.hueYB !== undefined ? DEF.hueYB : 0.89, DEFGR = DEF.hueGR !== undefined ? DEF.hueGR : 0.5;
  const trf = (k, f) => { const v = window.i18n ? window.i18n.t(k) : k; return v === k ? f : v; };
  function setGlow(v) { v = Math.max(0, Math.min(1, +v)); CFG.glow = v === v ? Math.round(v * 100) / 100 : 0; dirty = true; return CFG.glow; }   // internal (tests / comparison), not stored
  const hueNow = () => window.hue ? window.hue() : [DEFYB, DEFGR];
  function syncReset() { if (resetEl) { const h = hueNow(); resetEl.setAttribute('aria-disabled', String(tone === DEF.tone && Math.round(T * 100) === (DEF.depth >= 50 ? 100 : 0) && h[0] === DEFYB && h[1] === DEFGR && bands === DEFB)); } }
  // depth colour presets: one round swatch per palette (window.PALETTES, tone.js), a radiogroup with roving tabindex; a swatch moves the two colour sliders
  const palBtns = [];
  if (palEl) for (const nm of window.PALETTES) {
    const bt = document.createElement('button'); bt.type = 'button'; bt.setAttribute('role', 'radio'); bt.dataset.p = nm; bt.title = nm; bt.setAttribute('aria-label', nm);
    bt.style.setProperty('--sw', window.paletteSwatch(nm)); palEl.appendChild(bt); palBtns.push(bt);
  }
  function syncPal() {   // the ring marks the preset the sliders sit on (none for an in-between position: then the first swatch takes the tab stop)
    const cur = window.palette(), any = palBtns.some(b => b.dataset.p === cur);
    palBtns.forEach((bt, i) => { const on = bt.dataset.p === cur; bt.setAttribute('aria-checked', String(on)); bt.tabIndex = on || (!any && i === 0) ? 0 : -1; });
  }
  const pct = v => Math.round(Math.abs(v) * 100) + '%';
  function syncHueUI() {
    const h = hueNow();
    if (ybEl) { ybEl.value = Math.round(h[0] * 100); ybEl.setAttribute('aria-valuetext', h[0] === 0 ? trf('ctl.neutral', 'neutral') : (h[0] > 0 ? trf('ctl.blue', 'blue') : trf('ctl.yellow', 'yellow')) + ' ' + pct(h[0])); }
    if (grEl) { grEl.value = Math.round(h[1] * 100); grEl.setAttribute('aria-valuetext', h[1] === 0 ? trf('ctl.neutral', 'neutral') : (h[1] > 0 ? trf('ctl.red', 'red') : trf('ctl.green', 'green')) + ' ' + pct(h[1])); }
    for (const b of bandBtns) { const on = (bands < 50) === (b.dataset.b === '0'); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    if (moreEl) moreEl.style.setProperty('--hue', window.paletteSwatch());   // the disclosure's dot shows the current hue
  }
  function storeHue() {
    try { const h = hueNow(); localStorage.removeItem('palette'); if (h[0] === DEFYB && h[1] === DEFGR) { localStorage.removeItem('hueYB'); localStorage.removeItem('hueGR'); } else { localStorage.setItem('hueYB', String(h[0])); localStorage.setItem('hueGR', String(h[1])); } } catch (e) {}
  }
  function setHue(yb, gr, keep) { window.setHue(yb, gr); syncPal(); syncHueUI(); setTone(tone); if (keep) storeHue(); }   // setTone re-applies accent, line and the depth ramp (shades)
  function setPalette(nm, keep) { if (!window.paletteOk(nm)) return; const p = window.HUE_PRESETS[nm]; setHue(p[0], p[1], keep); }
  const binsOf = v => Math.round(CFG.depthBinsMin * Math.pow(CFG.depthBinsMax / CFG.depthBinsMin, 1 - v / 100));   // log scale: 100 -> 8, 40 -> 23, 0 -> 48
  function setBands(v, keep) {
    v = Math.max(0, Math.min(100, Math.round(+v))); if (v !== v) v = DEFB; bands = v;
    const nb = binsOf(v); if (nb !== CFG.depthBins) { CFG.depthBins = nb; if (cellBp) cellBp.fill(255); }   // new bin meaning: hysteresis state restarts
    hystB = CFG.depthHyst * Math.pow(nb / 8, CFG.depthHystK);
    shades(); syncHueUI(); dirty = true; syncReset();
    if (keep) try { if (bands === DEFB) localStorage.removeItem('bands'); else localStorage.setItem('bands', String(bands)); } catch (e) {}
  }
  function setTone(g) {
    g = Math.max(0, Math.min(255, Math.round(+g))); if (g !== g) g = 128; tone = g;
    const r = window.applyTone(g); INK = r.ink; ACCENT = 'rgb(' + r.accent + ')'; HALO = r.halo; shades();
    const txt = 'bg ' + p3(g) + ' ' + p3(g) + ' ' + p3(g);
    rgbEl.textContent = txt; toneEl.setAttribute('aria-valuetext', txt); dirty = true; syncReset();
  }
  function setDepth(t) {
    T = Math.max(0, Math.min(1, +t)); if (T !== T) T = 1; shades();
    for (const b of depthBtns) { const on = (T >= 0.5) === (b.dataset.t === '1'); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
    dirty = true; syncReset();
  }
  const snapT = t => (+t >= 0.5 ? 1 : 0);   // the user-facing control only has two states
  function pickDepth(t, focus) {
    setDepth(snapT(t)); pendDepth = null;
    try { localStorage.setItem('depth', T ? '100' : '0'); } catch (e) {}
    if (focus) for (const b of depthBtns) if (b.getAttribute('aria-checked') === 'true') b.focus();
  }
  let pendTone = null, pendDepth = null, pendHue = null, pendBands = null, uiRaf = 0;
  function flushUI() { uiRaf = 0; if (pendTone !== null) { setTone(pendTone); pendTone = null; } if (pendDepth !== null) { setDepth(pendDepth); pendDepth = null; }
    if (pendHue !== null) { setHue(pendHue[0], pendHue[1], false); pendHue = null; } if (pendBands !== null) { setBands(pendBands, false); pendBands = null; } }
  const later = () => { if (!uiRaf) uiRaf = requestAnimationFrame(flushUI); };
  toneEl.addEventListener('input', () => { pendTone = +toneEl.value; later(); });
  depthEl.addEventListener('click', e => { const b = e.target.closest('button[role=radio]'); if (b) pickDepth(+b.dataset.t, false); });
  depthEl.addEventListener('keydown', e => {
    const k = e.key, next = (k === 'ArrowRight' || k === 'ArrowDown') ? 0 : (k === 'ArrowLeft' || k === 'ArrowUp') ? 1 : k === 'Home' ? 1 : k === 'End' ? 0 : -1;
    if (next < 0) return; e.preventDefault(); pickDepth(next, true);
  });
  const roving = (el, sel, pick) => {   // arrow keys / Home / End move the checked radio and the focus
    el.addEventListener('click', e => { const b = e.target.closest(sel); if (b) pick(b, false); });
    el.addEventListener('keydown', e => {
      const bs = [...el.querySelectorAll(sel)], i = bs.findIndex(b => b.getAttribute('aria-checked') === 'true'), k = e.key, n = bs.length;
      const j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : -1;
      if (j < 0) return; e.preventDefault(); pick(bs[j], true);
    });
  };
  if (palEl) roving(palEl, 'button[role=radio]', (b, focus) => { setPalette(b.dataset.p, true); if (focus) b.focus(); });
  toneEl.addEventListener('change', () => { try { localStorage.setItem('tone', String(toneEl.value)); } catch (e) {} });
  // colour sliders: input previews (one ramp per frame), change stores; double-click returns to the centre notch (neutral)
  for (const el of [ybEl, grEl]) if (el) {
    el.addEventListener('input', () => { pendHue = [+ybEl.value / 100, +grEl.value / 100]; later(); });
    el.addEventListener('change', () => { pendHue = null; setHue(+ybEl.value / 100, +grEl.value / 100, true); });
    el.addEventListener('dblclick', () => { el.value = 0; pendHue = null; setHue(+ybEl.value / 100, +grEl.value / 100, true); });
  }
  if (bandsEl) {   // soft | stepped: a two-option radiogroup that works like the depth control (click; arrows / Home / End pick and focus, no wrap)
    const pickB = (v, focus) => { pendBands = null; setBands(v, true); if (focus) for (const b of bandBtns) if (b.getAttribute('aria-checked') === 'true') b.focus(); };
    bandsEl.addEventListener('click', e => { const b = e.target.closest('button[role=radio]'); if (b) pickB(b.dataset.b === '0' ? 0 : 100, false); });
    bandsEl.addEventListener('keydown', e => {
      const k = e.key, v = (k === 'ArrowRight' || k === 'ArrowDown' || k === 'End') ? 100 : (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'Home') ? 0 : -1;
      if (v < 0) return; e.preventDefault(); pickB(v, true);
    });
  }
  // colour disclosure: closed at every load on every screen (Alex, 2026-11-17); opened by a click, never stored
  function setMore(open) { if (!moreEl || !colEl) return; moreEl.setAttribute('aria-expanded', String(open)); colEl.hidden = !open; }
  if (moreEl) { setMore(false); moreEl.addEventListener('click', () => setMore(moreEl.getAttribute('aria-expanded') !== 'true')); }
  if (window.i18n && window.i18n.onChange) window.i18n.onChange(syncHueUI);
  if (resetEl) resetEl.addEventListener('click', () => {
    if (resetEl.getAttribute('aria-disabled') === 'true') return;
    pendTone = pendDepth = pendHue = pendBands = null; window.setHue(DEFYB, DEFGR); syncPal(); toneEl.value = DEF.tone; setTone(DEF.tone); setDepth(DEF.depth >= 50 ? 1 : 0); setBands(DEFB, false);
    try { for (const k of ['tone', 'depth', 'palette', 'hueYB', 'hueGR', 'bands']) localStorage.removeItem(k); } catch (e) {}   // not 'introSeen': the intro plays once ever
    syncReset();
  });
  {
    let g0 = DEF.tone; try { const sv = localStorage.getItem('tone'); if (/^\d{1,3}$/.test(sv || '') && +sv <= 255) g0 = +sv; } catch (e) {}
    toneEl.value = g0; syncPal(); setBands(bands, false); setTone(g0); setDepth(T);
  }

  // the language rail (i18n.js, wide screens: a vertical list at the left edge): the left gutter's boxes stay clear of it (symmetric, the brain stays centred)
  function railW() { const e = document.getElementById('lang'); if (!e || getComputedStyle(e).getPropertyValue('--rail').trim() !== '1') return 0; return Math.ceil(e.getBoundingClientRect().right) + 8; }
  // ---- layout ----
  function layout() {
    if (window.i18n && !document.getElementById('lang')) window.i18n.apply();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = document.documentElement.clientWidth; strips = vw < CFG.stripsBelow;
    let avail = Math.min(vw - 24, 1400);
    if (!strips) avail = Math.min(CFG.maxBrainW, avail * CFG.brainFrac);        // leave gutters for the labels
    ctx.font = CFG.weight + ' ' + FS + 'px ' + FONT; cw = ctx.measureText('M').width || 0.6 * FS; ch = Math.round(FS * 1.2); ASPECT = ch / cw;
    cols = Math.floor(avail / cw); cols = Math.min(cols, Math.floor(innerHeight * 0.76 / ch / 0.44));
    const apply = () => {
      const base = Math.round(cols * 0.44), R = (M ? M.radius : 92) * 1.03, need = Math.ceil(2 * R * SC() / ASPECT) + 2;   // rows the rotating brain can span (any pitch), plus a margin
      pad = Math.max(0, Math.ceil((need - base) / 2)); rows = base + 2 * pad;
      scene.style.width = cols * cw + 'px'; scene.style.height = base * ch + 'px'; canvas.style.top = glow.style.top = -pad * ch + 'px';
      canvas.width = Math.round(cols * cw * dpr); canvas.height = Math.round(rows * ch * dpr);
      canvas.style.width = cols * cw + 'px'; canvas.style.height = rows * ch + 'px';
      glow.width = canvas.width; glow.height = canvas.height; glow.style.width = canvas.style.width; glow.style.height = canvas.style.height;
      px = null; alloc(); dirty = true; rect = null; sizeLabels();
    };
    apply();
    // fit: if the (hidden, but space-reserving) contact line ends below the first screen, shrink the brain a little (at most CFG.fitMaxShrink)
    let over = contact.getBoundingClientRect().bottom + scrollY - (innerHeight - CFG.fitMarginPx);
    if (strips) {   // phones: the whole page (footer included) with the PPA info line clear of the fixed panel, if that is within the larger cap; else at least
      // the name (the contact is then scrolled into view on tap). The content is centred, so freeing 2 px moves the info line down by 1 px.
      const br_ = rows - 2 * pad, ctlEl = document.getElementById('ctl'), clear = ctlEl ? ctlEl.getBoundingClientRect().bottom - info.getBoundingClientRect().top : 0;
      const page = Math.max(0, document.documentElement.scrollHeight - innerHeight) + Math.max(0, 2 * clear), nm = sig.getBoundingClientRect().bottom + scrollY - (innerHeight - CFG.fitMarginPx);
      over = page > 0 && Math.ceil(page / ch) <= Math.floor(br_ * CFG.fitMaxShrinkStrips) ? Math.max(page, over) : Math.max(nm, Math.min(Math.max(page, over), Math.floor(br_ * CFG.fitMaxShrinkStrips) * ch));   // too much to fit: still shrink up to the cap (longer languages, 2026-11-17)
    }
    if (over > 0) {
      const br_ = rows - 2 * pad, minRows = Math.ceil(br_ * (1 - (strips ? CFG.fitMaxShrinkStrips : CFG.fitMaxShrink))), want = Math.max(minRows, br_ - Math.ceil(over / ch));
      if (want < br_) { cols = Math.floor(want / 0.44); apply(); }
    }
  }
  addEventListener('resize', layout);

  // ---- interaction ----
  let drag = null, moved = 0, ctr = null, lblOver = false;   // ctr: running click-to-centre rotation
  const now = () => performance.now();
  function cellAt(cx, cy) { const r = canvas.getBoundingClientRect(); return [Math.floor((cx - r.left) / cw), Math.floor((cy - r.top) / ch)]; }
  function hit(cx, cy) {
    if (!cellPpa) return false; const [c, r] = cellAt(cx, cy);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = c + dx, y = r + dy; if (x >= 0 && y >= 0 && x < cols && y < rows && cellPpa[y * cols + x]) return 'PPA'; }
    return false;
  }
  const tr = k => window.i18n ? window.i18n.t(k) : k;   // i18n.js (the 12 languages); the texts live there
  const PPA_TEXT = () => tr('info.ppa'), infoSr = document.getElementById('info-sr');
  function setPpa(on, ms) {
    if (on) { infoUntil = ms ? now() + ms : 0; if (!found) { found = true; dirty = true; } }
    if (on !== hoverPpa) { hoverPpa = on; if (on) { typeInto(info, PPA_TEXT()); infoSr.textContent = PPA_TEXT(); } else { endTyping(info); infoSr.textContent = ''; } info.classList.toggle('on', on); dirty = true; }
  }
  canvas.addEventListener('pointerdown', e => {
    clearHot(); cancelSwing(); canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, t: now(), type: e.pointerType }; moved = 0; vYaw = vPitch = 0; canvas.classList.add('grabbing');
  });   // (a press alone does not stop the idle spin: only the visitor's own turning does, once the drag moves)
  canvas.addEventListener('pointermove', e => {
    mouseAt = e.pointerType === 'mouse' ? [e.clientX, e.clientY] : null;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now() - drag.t);
      if (dx || dy) { if (!moved) foldNod(); lastInteract = now(); nextNod = now() + CFG.nodEvery; }   // the visitor turns the brain: spin and nod stop until CFG.spinResumeMs after it ends
      drag.x = e.clientX; drag.y = e.clientY; drag.t = now(); moved += Math.abs(dx) + Math.abs(dy);
      const ry = dx * 0.008, rp = dy * 0.008; yaw += ry; pitch = clampP(pitch + rp);
      vYaw = ry / dt * 16; vPitch = rp / dt * 16; dirty = true;
      if (moved > 4) hint.classList.add('gone');
    } else if (e.pointerType === 'mouse') { setPpa(!!hit(e.clientX, e.clientY)); hotAt(e.clientX, e.clientY, 0); }
  });
  function end(e) {
    if (!drag) return; const wasTap = moved < 6 && drag.type !== 'mouse'; drag = null; canvas.classList.remove('grabbing');
    if (wasTap) { vYaw = vPitch = 0; setPpa(!!hit(e.clientX, e.clientY), 3500); hotAt(e.clientX, e.clientY, 3500); }
  }
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { drag = null; canvas.classList.remove('grabbing'); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') mouseAt = null; if (e.pointerType === 'mouse' && !drag && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.lbl'))) { setPpa(false); clearHot(); } });
  function cancelSwing() { ctr = null; ppaHold = false; if (swT0 || sw) { sw = 0; swT0 = 0; dirty = true; } }
  const clampP = p => Math.max(-1.75, Math.min(1.75, p));
  // an idle nod is a temporary offset on the pitch; when anything takes over (drag, keys, click, centring) it is folded into the pitch so the view stays exactly where it is, with no jump
  function foldNod() { if (nod) pitch = clampP(pitch + nod); nod = 0; nodT0 = 0; }

  // keyboard: arrows rotate the brain
  canvas.addEventListener('keydown', e => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d || !M) return;
    cancelSwing();
    e.preventDefault(); yaw += d[0] * 0.2; pitch = clampP(pitch + d[1] * 0.2); foldNod(); vYaw = vPitch = 0; lastInteract = now(); nextNod = now() + CFG.nodEvery; hint.classList.add('gone');
    render(); if (ppaCount > 0) setPpa(true, 3500);
  });

  // ---- typing (one blinking cursor on the page) ----
  const typers = new Set(); let curEl = null;
  function setCur(el) { if (curEl && curEl !== el) curEl.classList.remove('cur-on'); curEl = el; if (el) el.classList.add('cur-on'); }
  function dropCur(el) { if (curEl && (curEl === el || el.contains(curEl))) { curEl.classList.remove('cur-on'); curEl = null; } }
  const putT = (e, v) => { if (window.i18n && window.i18n.put) window.i18n.put(e, v); else e.textContent = v; };   // text on the character grid (i18n.js: 2-cell boxes for Han / Indic clusters)
  const G_ = v => window.i18n && window.i18n.graphemes ? window.i18n.graphemes(v) : Array.from(v);   // typing goes by grapheme clusters (never half a conjunct)
  function prep(el, text) {
    let s = el._ty;
    if (!s) {
      el.textContent = '';
      const a = document.createElement('span'), c = document.createElement('i'), r = document.createElement('span');
      a.setAttribute('aria-hidden', 'true'); c.className = 'cur'; c.setAttribute('aria-hidden', 'true'); r.className = 'rest'; r.setAttribute('aria-hidden', 'true');
      el.append(a, c, r); s = el._ty = { el, a, r, text: '', n: 0 };
    }
    typers.delete(s); s.text = text; s.g = G_(text); s.n = 0; s.started = false; s.pasted = false; s.paste = false; s.endCur = true; s.noCur = false;
    s.a.classList.remove('sel'); s.a.textContent = ''; putT(s.r, text);
    return s;
  }
  function typeInto(el, text, o = {}) {
    const s = prep(el, text);
    if (reduced) { putT(s.a, text); s.r.textContent = ''; s.n = s.g.length; s.at = now(); s.dur = 0; return s; }
    s.at = o.at || now(); s.dur = Math.min(s.g.length * CFG.charMs, CFG.lineMs); s.paste = !!o.paste; s.endCur = o.endCursor !== false;
    typers.add(s); return s;
  }
  function endTyping(el) {   // show the full text now and drop the cursor
    const s = el._ty; if (!s) return;
    typers.delete(s); s.a.classList.remove('sel'); putT(s.a, s.text); s.r.textContent = ''; s.n = s.g.length; dropCur(el);
  }
  function stepTypers(tn) {
    for (const s of typers) {
      if (tn < s.at) continue;
      if (!s.started) { s.started = true; setCur(s.el); }
      const len = s.g.length;
      if (s.paste) {
        if (!s.pasted) { s.pasted = true; putT(s.a, s.text); s.r.textContent = ''; s.a.classList.add('sel'); s.n = len; }
        else if (tn >= s.at + CFG.pasteMs) { s.a.classList.remove('sel'); typers.delete(s); }
        continue;
      }
      const n = s.dur > 0 ? Math.min(len, Math.floor((tn - s.at) / s.dur * len)) : len;
      if (n !== s.n) { s.n = n; putT(s.a, s.g.slice(0, n).join('')); putT(s.r, s.g.slice(n).join('')); }
      if (n >= len) { typers.delete(s); if (s.endCur && s.noCur) dropCur(s.el); }
    }
  }

  // ---- bio labels ----
  const root = document.documentElement;
  const sig = document.getElementById('sig'), contact = document.getElementById('contact'), nmEl = document.getElementById('nm'), ctEl = document.getElementById('ct');
  const lblBox = document.getElementById('labels'), svgL = document.getElementById('leaders'), scene = document.getElementById('scene'), stageEl = document.getElementById('stage');
  const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  // Four boxes, area first (decision page "Area Label Decisions", Alex 2026-11-07). Texts: i18n 'area.<id>' (headline), 'does.<id>' (what it does),
  // 'route.<id>' (my route there: the degree, word for word), 'intern.ppa' (the PPA's second route line). Layout B: at rest a box shows the area and
  // what it does; the route opens on hover, keyboard focus, tap, or the click that turns the brain to the area, and stays CFG.lingerMs after that ends.
  const LB = [
    { id: 'eng', h: 0, ras: [-40, 36, 26], n: nrm3([-0.6, 0.7, 0.4]) },     // left dorsolateral prefrontal cortex (atlas label at the dot: middle frontal gyrus)
    { id: 'phil', h: 1, ras: [28, 56, 12], n: nrm3([0.4, 0.9, 0.15]) },     // right frontal pole (the dot the MSc box used)
    { id: 'psy', h: -2, n: null, inside: true },                             // the nearer amygdala, inside the brain: anchor set every frame by amyTrack
    { id: 'ppa', h: -1, n: null }
  ];
  const SVGNS = 'http://www.w3.org/2000/svg', PPA_L = LB.find(l => l.id === 'ppa'), PSY_L = LB.find(l => l.id === 'psy');
  const span = (cls, hid) => { const e = document.createElement('span'); if (cls) e.className = cls; if (hid) e.setAttribute('aria-hidden', 'true'); return e; };
  LB.forEach((l, i) => {
    l.delay = l.id === 'ppa' ? 0 : i * 80; l.u = 0; l.tgt = 0; l.start = 0; l.w = 0; l.h_ = 0; l.hR = 0; l.hO = 0; l.box = { x: 0, y: 0, w: 0, h: 0, alpha: 0 };
    l.sx = l.sy = l.fx = l.fy = 0; l.snap = true; l.shown = false; l.hot = false; l.lastType = -1e9; l.crossing = false; l.swapT = -1e9; l.swF = 1; l.popT0 = 0; l.solid = false; l.ovF = 1;
    l.open = false; l.oa = 0; l.openUntil = 0; l.hov = false; l.foc = false; l.as = 0; l.asT = 0; l.opened = false;   // open state (target), open amount 0..1, phones: stepped aside 0..1; opened: ever, this visit
    l.grp = (l.id === 'eng' || l.id === 'phil') ? 0 : 1;     // strips mode: 0 = above the brain, 1 = below
    l.el = document.createElement('div'); l.el.className = 'lbl'; l.el.tabIndex = 0; l.el.setAttribute('role', 'button');
    l.bEl = document.createElement('b'); l.sEl = document.createElement('small');
    l.rEl = span('rt', true); const r1 = span('rl'); l.leadEl = document.createElement('i'); l.r1v = span('rv'); r1.append(l.leadEl, ' ', l.r1v); l.rEl.appendChild(r1);
    if (l.id === 'ppa') { const r2 = span('rl'); l.r2v = span('rv'); r2.appendChild(l.r2v); l.rEl.appendChild(r2); }
    lbTexts(l); prepTexts(l);
    l.el.append(l.bEl, l.sEl, l.rEl); lblBox.appendChild(l.el);
    l.el.addEventListener('click', () => { centreOn(l); openLbl(l, l.hov || l.foc); });   // mouse click, tap, or Enter / Space (keydown below): turn to the area and open
    l.el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); centreOn(l); openLbl(l, l.foc); } });
    l.el.addEventListener('focus', () => { focusLbl = l.el.matches(':focus-visible'); if (focusLbl) { l.foc = true; openLbl(l, true); } upd(); });   // keyboard focus only: a mouse click must not hold the labels open past the linger
    l.el.addEventListener('blur', () => { focusLbl = false; if (l.foc) { l.foc = false; releaseLbl(l); } upd(); });
    l.el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { lblOver = true; cancelSticky(); l.hov = true; openLbl(l, true); } });
    l.el.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; lblOver = false; l.hov = false; releaseLbl(l); if (hoverSig && !inZone(e.clientX, e.clientY)) startSticky(); else if (!hoverSig && !pinned && !hoverPpa) clearHot(); });
    // shadows: a wider low-alpha dark path + a larger dot under each leader (cheap: no filter, two extra tiny SVG nodes), drawn first so they sit under every line
    l.lnS = document.createElementNS(SVGNS, 'path'); l.lnS.setAttribute('class', 'shl'); l.lnS.style.opacity = 0; svgL.insertBefore(l.lnS, svgL.firstChild);
    l.dotS = document.createElementNS(SVGNS, 'ellipse'); l.dotS.setAttribute('class', 'shd'); l.dotS.setAttribute('rx', '4'); l.dotS.setAttribute('ry', '4'); l.dotS.style.opacity = 0; svgL.insertBefore(l.dotS, svgL.firstChild);
    l.ln = document.createElementNS(SVGNS, 'line'); l.ln.style.opacity = 0; svgL.appendChild(l.ln);
    l.dot = document.createElementNS(SVGNS, 'circle'); l.dot.setAttribute('r', '2.5'); l.dot.setAttribute('data-id', l.id); l.dot.style.opacity = 0; svgL.appendChild(l.dot);
    if (l.inside) {   // the dot sits inside the brain: the leader turns dotted where it enters the brain and ends at a ring with a small centre
      l.lnInS = document.createElementNS(SVGNS, 'path'); l.lnInS.setAttribute('class', 'shi'); l.lnInS.style.opacity = 0; svgL.insertBefore(l.lnInS, svgL.firstChild);
      l.lnIn = document.createElementNS(SVGNS, 'path'); l.lnIn.setAttribute('class', 'in'); l.lnIn.style.opacity = 0; svgL.insertBefore(l.lnIn, l.ln);
      l.dot.setAttribute('class', 'ring'); l.dot.setAttribute('r', '3.4'); l.dotS.setAttribute('class', 'shd ring'); l.dotS.setAttribute('rx', '3.4'); l.dotS.setAttribute('ry', '3.4');
      l.dot2 = document.createElementNS(SVGNS, 'circle'); l.dot2.setAttribute('r', '1.2'); l.dot2.setAttribute('data-id', l.id + '-c'); l.dot2.style.opacity = 0; svgL.appendChild(l.dot2);
    }
  });
  function lbTexts(l) {
    l.area = tr('area.' + l.id); l.does = tr('does.' + l.id); l.route = tr('route.' + l.id); l.intern = l.r2v ? tr('intern.ppa') : ''; l.main = (window.i18n && window.i18n.rtl && window.i18n.rtl() ? '<' : '>') + ' ' + l.area;   // the prompt marker points into the text: '<' at the right edge in Arabic / Urdu
    l.el.setAttribute('aria-label', l.area + ': ' + l.does + '. ' + tr('route.lead') + ' ' + l.route + (l.intern ? '; ' + l.intern : '') + ' ' + tr('lbl.act'));   // screen readers: all lines, open or not
  }
  function prepTexts(l) { prep(l.bEl, l.main); prep(l.sEl, l.does); prep(l.r1v, l.route); if (l.r2v) prep(l.r2v, l.intern); putT(l.leadEl, tr('route.lead')); }
  const routeEls = l => l.r2v ? [l.r1v, l.r2v] : [l.r1v];
  function relang() {   // i18n.set(): new texts at once (no retyping), then the resize path (layout -> sizeLabels) re-measures the fixed box sizes and strips
    for (const l of LB) { lbTexts(l); prepTexts(l); if (l.tgt || l.u > 0) { endTyping(l.bEl); endTyping(l.sEl); for (const e of routeEls(l)) endTyping(e); } }
    if (hoverPpa) { prep(info, PPA_TEXT()); endTyping(info); infoSr.textContent = PPA_TEXT(); }
    layout();
  }
  if (window.i18n) window.i18n.onChange(relang);
  function typeLabel(l) {
    l.lastType = now();
    const a = typeInto(l.bEl, l.main, { at: l.start }), b = typeInto(l.sEl, l.does, { at: l.start + a.dur + 60 });
    if (l.open) typeRoute(l, l.start + a.dur + b.dur + 120);
  }
  function typeRoute(l, at) {   // the route types after the box opens; the PPA's internship line is "pasted" (as its lab line was)
    const a = typeInto(l.r1v, l.route, { at });
    if (l.r2v) typeInto(l.r2v, l.intern, { at: at + a.dur + 60, paste: true });
  }
  // ---- open / close (layout B): one box open at a time ----
  let openL = null;
  function openLbl(l, hold, instant) {   // hold: while hovered / focused (no timer); otherwise open for CFG.lingerMs from now
    if (openL && openL !== l) closeLbl(openL);
    openL = l; l.opened = true; l.openUntil = hold ? Infinity : Math.max(l.open && l.openUntil !== Infinity ? l.openUntil : 0, now() + CFG.lingerMs);
    if (!l.open) {
      l.open = true; l.el.classList.add('rto');
      if (instant || reduced) l.oa = 1;
      if (l.u > 0 || l.tgt) { const s = l.sEl._ty; typeRoute(l, Math.max(now(), s && typers.has(s) ? s.at + s.dur + 60 : 0)); }   // after the two lines if they are still typing
      setH(l);
    }
    dirty = true;
  }
  function releaseLbl(l) { if (l.open && !l.hov && !l.foc && l.openUntil === Infinity) l.openUntil = now() + CFG.lingerMs; }   // hover / focus ended: the linger starts
  function closeLbl(l) { if (!l.open) return; l.open = false; if (openL === l) openL = null; for (const e of routeEls(l)) endTyping(e); if (reduced) { l.oa = 0; restLbl(l); } dirty = true; }
  function restLbl(l) { l.el.classList.remove('rto'); setH(l); }   // fully closed: the route is no longer laid out
  function setH(l) { const h = l.hR + (l.hO - l.hR) * (l.oa <= 0 ? 0 : l.oa >= 1 ? 1 : l.oa * l.oa * (3 - 2 * l.oa)); if (h !== l.h_) { l.h_ = h; if (h) l.el.style.height = h + 'px'; } }
  function sizeLabels() {   // measure labels (the full text is always laid out, see prep); reserve strip space on narrow screens
    const CWp = cols * cw, mw = strips ? Math.min(360, vw - 24) : Math.max(110, Math.min(CFG.lblMax, (vw - CWp) / 2 - CFG.lblGap - 6 - railW()));
    // fixed box sizes: measured once per layout with the full text laid out, then set as width/height, so a shown label changes size only while it opens
    // or closes (and the leader's end, computed from l.w / l.h_, sits exactly on its edge); measured without the transform (the PPA pop scales it).
    // Two reads for all boxes: open (route shown, natural width), then rest at that same width (only the height differs between the two)
    const tf = LB.map(l => { const st = l.el.style, t = st.transform; st.transform = 'none'; st.width = st.height = ''; st.maxWidth = mw + 'px'; l.el.classList.add('m-open'); return t; });
    const ro = LB.map(l => l.el.getBoundingClientRect());
    LB.forEach((l, i) => { l.w = ro[i].width; l.hO = ro[i].height; l.el.style.width = l.w + 'px'; l.el.classList.remove('m-open'); l.el.classList.add('m-rest'); });
    const rr = LB.map(l => l.el.getBoundingClientRect());
    const res = [[0, 0, 0], [0, 0, 0]];   // per strip: sum of rest heights, count, tallest open box
    LB.forEach((l, i) => {
      l.hR = rr[i].height; l.el.classList.remove('m-rest'); l.h_ = -1; setH(l); l.el.style.transform = tf[i]; l.snap = true;
      const q = res[l.grp]; q[0] += l.hR; q[1]++; q[2] = Math.max(q[2], l.hO);
    });
    // phones: room for all boxes at rest, or for one open box alone (its neighbour steps aside), so opening a box never moves the brain
    const strip = q => Math.max(q[0] + CFG.lblStripGap * (q[1] - 1), q[2]) + 12 + 'px';
    root.style.setProperty('--st', strips ? strip(res[0]) : '0px');
    root.style.setProperty('--sb', strips ? strip(res[1]) : '0px');
    const sr = scene.getBoundingClientRect(); sceneLeft = sr.left; sceneTop = sr.top + scrollY;
  }
  function snapAnchors(m) {   // nearest vertex of the right hemisphere to each target (mesh space = RAS - centre)
    for (const l of LB) {
      if (l.h < 0) continue;
      const t = [l.ras[0] - m.cen[0], l.ras[1] - m.cen[1], l.ras[2] - m.cen[2]], i0 = l.h ? 10242 : 0, i1 = l.h ? m.nv : 10242; let bi = i0, bd = 1e12;
      for (let i = i0; i < i1; i++) { const j = i * 3, d = (m.pos[j] - t[0]) ** 2 + (m.pos[j + 1] - t[1]) ** 2 + (m.pos[j + 2] - t[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      l.a = [m.pos[bi * 3], m.pos[bi * 3 + 1], m.pos[bi * 3 + 2]];
    }
    AMYC = CFG.amyRas.map(c => [c[0] - m.cen[0], c[1] - m.cen[1], c[2] - m.cen[2]]);   // amygdala centres in mesh space
    amyTrack(rotation(), 0, true);
  }
  // psychology: the dot sits at the centre of the nearer amygdala (inside the brain), so it changes side as the brain turns: with hysteresis
  // (CFG.amySwitchMm), then it glides through the brain to the other side (CFG.amyGlideMs). l.n = the anchor's direction from the brain centre.
  let AMYC = null, amyH = 1, amyS = 1;   // centres [left, right]; followed side; glide position 0 = left .. 1 = right
  function amyTrack(R, dt, snap) {
    if (!AMYC) return;
    const z = AMYC.map(c => R[2][0] * c[0] + R[2][1] * c[1] + R[2][2] * c[2]), o = 1 - amyH;
    if (z[o] > z[amyH] + CFG.amySwitchMm) amyH = o;
    if (snap || reduced || !PSY_L.shown) amyS = amyH;   // nothing to glide while the box is hidden
    else if (amyS !== amyH) { amyS = amyH > amyS ? Math.min(1, amyS + dt / CFG.amyGlideMs) : Math.max(0, amyS - dt / CFG.amyGlideMs); if (amyOn) dirty = true; }
    const e = smooth01(amyS), a = [0, 1, 2].map(k => AMYC[0][k] + (AMYC[1][k] - AMYC[0][k]) * e);
    PSY_L.a = a; PSY_L.n = nrm3(a);
  }
  const SC = () => cols * 0.96 / 182;
  const projP = (R, x, y, z) => { const sc = SC(); return [(cols / 2 + (R[0][0] * x + R[0][1] * y + R[0][2] * z) * sc) * cw, (rows / 2 - pad - (R[1][0] * x + R[1][1] * y + R[1][2] * z) * sc / ASPECT) * ch]; };
  const facing = (R, n) => R[2][0] * n[0] + R[2][1] * n[1] + R[2][2] * n[2];
  // hover / tap on an anchor region reveals that label (labels themselves ignore the pointer)
  let hotUntil = 0;
  function setHot(l) {
    let ch_ = false;
    for (const q of LB) { const v = q === l; if (q.hot !== v) { q.hot = v; ch_ = true; } }
    if (ch_) dirty = true;
    return ch_;
  }
  function hotAt(cx, cy, ms) {
    if (!M) return;
    const r = scene.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, R = rotation();
    let best = null, bd = CFG.hotR, cur = null;
    for (const l of LB) {
      if (l.id === 'ppa' || !l.a) continue;
      if (!l.inside && facing(R, l.n) < 0.3) continue;   // the amygdala dot is inside: it can be pointed at from any side
      const A = projP(R, l.a[0], l.a[1], l.a[2]), d = Math.hypot(A[0] - x, A[1] - y);
      if (d < bd) { bd = d; best = l; }
      if (l.hot && d < CFG.hotR * 1.5) cur = l;
    }
    const pick = best || (ms ? null : cur);
    hotUntil = pick && ms ? now() + ms : 0;
    if (setHot(pick) && pick && pick.tgt && pick.u >= 1 && !typers.size && now() - pick.lastType > 1500) { pick.start = now(); typeLabel(pick); }
  }
  const clearHot = () => { hotUntil = 0; setHot(null); };
  let hoverSig = false, focusSig = false, focusCt = false, focusLbl = false, pinned = false, lastLbl = now(), popped = false, ctOn = false;
  const showAll = () => hoverSig || focusSig || pinned || focusCt || focusLbl;
  function upd() {
    const on = showAll(); contact.hidden = !on; dirty = true;
    if (on !== ctOn) { ctOn = on; if (ctEl) { if (on && !reduced) { const s = typeInto(ctEl, 'alex.zalen@ru.nl', { at: now() }); s.noCur = true; } else endTyping(ctEl); } }
  }
  function revealContact() {   // tap / pin / keyboard: make sure the email is inside the visible viewport
    requestAnimationFrame(() => { const b = contact.getBoundingClientRect(); if (b.bottom > innerHeight || b.top < 0) contact.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); });
  }
  // click / Enter / Space on a label: rotate (ease-in-out, CFG.centerMs) so that its anchor faces the viewer in the middle of the view.
  // Camera = Rx(pitch) Ry(yaw) B, so with u = B*anchor: yaw = atan2(-ux, uz), pitch = atan2(uy, hypot(ux, uz)) puts R*anchor on the +z axis, i.e. the
  // projected anchor is exactly at the canvas centre (rotation only, no pan needed: the scale and the brain's centre stay as they are).
  function anchorOf(l) {
    if (l.a) return l.a;
    if (l.id === 'ppa') { if (!PV || !PV[ppaH].length) return null; const a = [0, 0, 0]; for (const i of PV[ppaH]) for (let k = 0; k < 3; k++) a[k] += M.pos[i * 3 + k] / PV[ppaH].length; return a; }   // mean of the followed hemisphere's PPA (hooks only)
    return null;
  }
  function centreTarget(a) {
    const ux = -a[1], uy = a[2], uz = -a[0], h = Math.hypot(ux, uz); if (h < 1e-6) return null;
    let dy = Math.atan2(-ux, uz) - yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;   // shortest way round
    return { dy, p: clampP(Math.atan2(uy, h)) };
  }
  function centreOn(l) {
    if (!M) return; let t;
    if (l.id === 'ppa') {   // the PPA is ventromedial: no rotation puts a well-visible PPA exactly in the middle, so turn to a fixed view that shows the left PPA (the larger one) closest to the centre
      let dy = CFG.ppaView[0] * Math.PI / 180 - yaw; dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      t = { dy, p: CFG.ppaView[1] * Math.PI / 180 };
    } else { const a = anchorOf(l); t = a && centreTarget(a); }
    if (!t) return;
    hint.classList.add('gone'); foldNod(); vYaw = vPitch = 0; nextNod = now() + CFG.nodEvery; cancelSwing();   // (the idle spin waits only for the turn itself, then eases in again)
    if (l.id !== 'ppa') { setHot(l); hotUntil = now() + CFG.centerMs + 3500; } else ppaHold = true;   // pointer stays on the left PPA until the next interaction or the idle spin
    if (reduced || CFG.centerMs <= 0) { yaw += t.dy; pitch = t.p; render(); return; }
    ctr = { t0: now(), y0: yaw, dy: t.dy, p0: pitch, p1: t.p };
  }
  // sticky hover: once the mouse has entered the name, the contact stays until the pointer is outside the "safe zone"
  // (union of the name and contact rects, incl. the gap between, grown by CFG.stickyPx), checked on document pointermove (no overlay element)
  let stickyTm = 0;
  const cancelSticky = () => { if (stickyTm) { clearTimeout(stickyTm); stickyTm = 0; } };
  const startSticky = () => { if (stickyTm) return; stickyTm = setTimeout(() => { stickyTm = 0; hoverSig = false; upd(); }, CFG.lingerMs); };   // linger: labels + contact fade out after CFG.lingerMs
  function inZone(x, y) {
    const a = sig.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(contact); const c = rg.getBoundingClientRect(), m = CFG.stickyPx;
    const l = Math.min(a.left, c.width ? c.left : a.left) - m, r = Math.max(a.right, c.width ? c.right : a.right) + m, t = Math.min(a.top, c.height ? c.top : a.top) - m, b = Math.max(a.bottom, c.height ? c.bottom : a.bottom) + m;
    return x >= l && x <= r && y >= t && y <= b;
  }
  const stickyCheck = e => { if (e.pointerType !== 'mouse' || !hoverSig) return; if (inZone(e.clientX, e.clientY) || (e.target.closest && e.target.closest('.lbl'))) cancelSticky(); else startSticky(); };
  document.addEventListener('pointermove', stickyCheck, { passive: true });
  document.documentElement.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && hoverSig) startSticky(); });   // left the window: keep for a while, hide unless it returns
  contact.addEventListener('focusin', () => { focusCt = true; upd(); revealContact(); });
  contact.addEventListener('focusout', () => { focusCt = false; upd(); });
  sig.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { cancelSticky(); hoverSig = true; IN.nameFound = true; upd(); } });   // nameFound: the intro's name hint is not needed any more
  sig.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && hoverSig) { if (inZone(e.clientX, e.clientY)) cancelSticky(); else startSticky(); } });
  sig.addEventListener('click', () => { IN.nameFound = true; pinned = !pinned; sig.setAttribute('aria-pressed', String(pinned)); upd(); if (pinned) revealContact(); });
  sig.addEventListener('focus', () => { if (sig.matches(':focus-visible')) { focusSig = true; IN.nameFound = true; upd(); revealContact(); } });
  sig.addEventListener('blur', e => { focusSig = false; if (e.relatedTarget && contact.contains(e.relatedTarget)) focusCt = true; upd(); });   // Tab from the name to the email: keep the contact (it is visibility:hidden otherwise and could not take focus)
  document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || !pinned || sig.contains(e.target) || contact.contains(e.target) || lblBox.contains(e.target)) return; pinned = false; sig.setAttribute('aria-pressed', 'false'); upd(); });   // phone: tap anywhere else hides the pinned email
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pinned) { pinned = false; sig.setAttribute('aria-pressed', 'false'); upd(); } });

  // ---- first visit: a faint ghost hand hints where hovering does something (it replaced the "click me" cue: nothing needs a click, hovering does it) ----
  // A hint only, it reveals nothing: a faint drawn copy of the system's pointing-hand cursor (a page can neither move nor recolour the real one),
  // Mac or Windows shape, in the PPA colour. It is purely visual: no hover state, no info line, no glow change, no box, no route, no contact.
  // The hints follow what the visitor has NOT found yet this visit, in the order PPA -> name -> box, each at most once:
  //   PPA   found once the visitor hovers, taps or clicks it (or its box opens; arrow keys that show it count too: __brain.found());
  //   name  found once the visitor hovers, focuses, taps or clicks the name;
  //   box   a box counts once it is opened (hover, focus, tap, click, the PPA box's own pop); the box hint points once at a rolled-up box not
  //         yet opened, and only while boxes are in view (the visitor revealed them).
  // A run shows the next hints in that order, one leg each, skipping what is found (or not in view), then fades: e.g. PPA then name on a first
  // visit; name only (after CFG.introIdleMs of stillness) if the visitor found the PPA alone; PPA then a box if the visitor hovered the name first.
  // Each run waits for stillness (the PPA: CFG.introDelayMs, the name: CFG.introIdleMs, a box: CFG.introBoxStillMs) and for its first target:
  // the PPA in view (CFG.introPpaMin cells; the brain keeps turning and the idle nod peeks underneath; after CFG.introPpaWaitMs the run goes on
  // without it). On the PPA the hand follows the turning blob frame by frame (lightly smoothed); if the PPA turns away, the leg ends early.
  // The brain is never held for a hint. Any real input (pointer, touch, key, wheel, scroll, resize, language, tab hidden) ends the run at once
  // (the ghost goes; nothing else changes); the leg it was on counts as shown, the rest wait for stillness again.
  // Once ever: localStorage 'introSeen' (else this tab's sessionStorage; if neither can be written it never plays), set when the first hint shows
  // or once everything is found, cleared by nothing (the reset button neither); ?intro=1 in the URL plays it again. It gives up for this visit after
  // CFG.introGiveUpMs. Never with reduced motion or without a hovering pointer (touch: the tap logic is unchanged).
  // The hand moves by transform / opacity only: per frame on the PPA leg, by WAAPI towards the name and a box (those do not move).
  const IN = { st: 'off', step: '', box: '', kind: '', tok: 0, tm: 0, el: null, x: 0, y: 0, t0: 0, last: 0, rdy: 0, mx: NaN, my: NaN, nameFound: false, hinted: new Set(), shown: false };
  const HANDS = {   // viewBox 18 x 22; hs = hotspot (the index fingertip), s = css px per unit, d = outline, k = the creases between the folded fingers
    win: { s: 1, hs: [7, 0.6], d: 'M5.5 2.2C5.5 1.2 6.2 .6 7 .6S8.5 1.2 8.5 2.2V7.6C8.6 6.8 9.2 6.3 9.8 6.3S11 6.8 11 7.7C11.1 7.2 11.6 6.9 12.2 6.9S13.4 7.4 13.4 8.3C13.5 7.9 14 7.6 14.6 7.6S15.8 8.1 15.8 8.9V13.6C15.8 15.6 15.1 17 14 18.3V21.4H6.6V19.3C5.6 18.3 4.6 17.2 3.6 15.8L1.5 12.7C1 12 1.2 11.1 1.9 10.8S3.3 10.8 3.7 11.4L5.5 13.7Z', k: 'M8.5 7.6V9.8M11 7.7V9.8M13.4 8.3V10' },
    mac: { s: 0.92, hs: [7.3, 0.7], d: 'M5.6 2.5C5.6 1.4 6.3 .7 7.3 .7S9 1.4 9 2.5V7.4C9.3 6.7 9.9 6.4 10.5 6.4C11.3 6.4 11.9 7 12 7.8C12.3 7.3 12.8 7 13.4 7C14.2 7 14.8 7.6 14.9 8.4C15.2 8.1 15.6 8 16 8C16.8 8 17.3 8.6 17.3 9.4V13.6C17.3 16.6 15.6 18.6 14.4 19.6V21.3H7.6V19.9C6.4 19 5.3 17.8 4.4 16.4L2 12.9C1.5 12.1 1.7 11.2 2.4 10.8C3.1 10.4 3.9 10.6 4.4 11.2L5.6 12.7Z', k: 'M9 7.4V9.9M12 7.8V10M14.9 8.4V10.2' }
  };
  function handKind() { const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''; return /mac|iphone|ipad/i.test(p) ? 'mac' : /win/i.test(p) ? 'win' : 'gen'; }
  function ghostEl(kind) {   // other systems ('gen') get the rounded hand at the Windows size; all at CFG.introScale of the system hand
    const q = HANDS[kind === 'win' ? 'win' : 'mac'], s = (kind === 'mac' ? q.s : 1) * CFG.introScale, g = document.createElementNS(SVGNS, 'svg');
    g.id = 'ghost'; g.dataset.kind = kind; g.setAttribute('aria-hidden', 'true'); g.setAttribute('focusable', 'false');
    g.setAttribute('viewBox', '0 0 18 22'); g.setAttribute('width', +(18 * s).toFixed(2)); g.setAttribute('height', +(22 * s).toFixed(2));
    g.style.marginLeft = -q.hs[0] * s + 'px'; g.style.marginTop = -q.hs[1] * s + 'px';   // so that translate(x, y) puts the fingertip at (x, y)
    g.innerHTML = '<path class="gf" d="' + q.d + '"/><path class="gk" d="' + q.k + '"/>';
    document.body.appendChild(g); return g;
  }
  const STORES = ['localStorage', 'sessionStorage'];
  function introSeen() { for (const s of STORES) try { if (window[s].getItem('introSeen')) return true; } catch (e) {} return false; }
  function introStore() { for (const s of STORES) try { window[s].setItem('introSeen', '1'); return true; } catch (e) {} return false; }
  const IN_EV = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'resize', 'visibilitychange'];
  function introListen(on) { for (const t of IN_EV) window[on ? 'addEventListener' : 'removeEventListener'](t, introInput, { capture: true, passive: true }); }
  function introInput(e) {   // note the time of the last input (hints wait for stillness); a hint showing ends at once
    if (e.type === 'visibilitychange') { IN.last = now(); if (document.hidden) introStop(); return; }
    if (e.type === 'pointermove' && e.pointerType === 'mouse') {   // a move without movement (the browser re-checking hover after the page changed under a resting mouse) is not input
      const mv = e.movementX || e.movementY || (IN.mx === IN.mx && Math.hypot(e.clientX - IN.mx, e.clientY - IN.my) > 1);
      IN.mx = e.clientX; IN.my = e.clientY; if (!mv) return;
    }
    IN.last = now(); introStop();
  }
  const HINTS = ['ppa', 'name', 'box'];
  const ppaFound = () => found || LB.some(l => l.id === 'ppa' && l.opened);
  const isFound = k => k === 'ppa' ? ppaFound() : k === 'name' ? IN.nameFound : LB.every(l => l.opened);
  const todo = () => HINTS.filter(k => !isFound(k) && !IN.hinted.has(k));
  const handAt = () => (IN.mx === IN.mx ? [IN.mx, IN.my] : nameClient());
  function introEnd(st) { ghostGone(); IN.st = st; IN.step = ''; introListen(false); if (st === 'done') introStore(); }
  function introArm() {
    let forced = false; try { forced = new URLSearchParams(location.search).get('intro') === '1'; } catch (e) {}
    if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches || (!forced && introSeen())) { IN.st = 'skip'; return; }
    IN.st = 'wait'; IN.t0 = IN.last = now(); introListen(true); introWait();
  }
  function introWait() {   // waits for stillness and the next hint's target, then runs
    const chk = () => {
      if (IN.st !== 'wait') return;
      const t = now(), td = todo();
      if (!td.length) { introEnd('done'); return; }   // everything found or hinted
      if (t - IN.t0 > CFG.introGiveUpMs) { introEnd(IN.shown ? 'done' : 'skip'); return; }   // not this visit (marked as seen only if a hint showed)
      const busy = document.hidden || drag || ctr || hoverPpa || openL || typers.size || LB.some(l => l.hot) || !!glA;   // (not during a glitch)
      const k = td[0], need = k === 'ppa' ? CFG.introDelayMs : k === 'name' ? CFG.introIdleMs : CFG.introBoxStillMs;
      const ready = !busy && t - IN.t0 >= CFG.introDelayMs && t - IN.last >= need;
      if (!ready) IN.rdy = 0; else if (!IN.rdy) IN.rdy = t;
      if (ready) {
        const ppaOk = ppaCount >= CFG.introPpaMin && !!inView(ppaClient());   // else wait for the turning (or nodding) brain to bring the PPA into view...
        const skipPpa = k === 'ppa' && !ppaOk && t - IN.rdy >= CFG.introPpaWaitMs;   // ...but not for ever: then the next hint goes on without it
        const rest = td.filter(q => q !== 'ppa'), avail = q => q === 'name' ? !!inView(nameClient()) : q === 'box' ? !!introBox(handAt()) : ppaOk;
        if ((k === 'ppa' && ppaOk) || (k !== 'ppa' && avail(k)) || (skipPpa && rest.some(avail))) { introRun(skipPpa); return; }
      }
      IN.tm = setTimeout(chk, 250);
    };
    clearTimeout(IN.tm); IN.tm = setTimeout(chk, 250);
  }
  const tl = (x, y) => 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  const inView = P => P && P[0] >= 8 && P[1] >= 8 && P[0] <= innerWidth - 8 && P[1] <= innerHeight - 8 ? P : null;
  function glide(P) {   // a slow, nearly straight drift (a slight arc) from where the hand is to P, eased in and out; returns its duration (ms)
    const x0 = IN.x, y0 = IN.y, dx = P[0] - x0, dy = P[1] - y0, cx = (x0 + P[0]) / 2 - dy * 0.08, cy = (y0 + P[1]) / 2 + dx * 0.08, kf = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; kf.push({ transform: tl(a * x0 + b * cx + c * P[0], a * y0 + b * cy + c * P[1]) }); }
    const ms = clamp(870 + Math.hypot(dx, dy) * 1.15, 1100, 1900);
    IN.el.animate(kf, { duration: ms, easing: 'ease-in-out', fill: 'forwards' }); IN.x = P[0]; IN.y = P[1];
    return ms;
  }
  function ghostIn(S) {   // the hand appears at S, fading in slowly
    IN.el = ghostEl(IN.kind); IN.x = S[0]; IN.y = S[1]; IN.el.style.transform = tl(S[0], S[1]);
    IN.el.animate({ opacity: [0, CFG.introAlpha] }, { duration: CFG.introFadeMs, easing: 'ease-out', fill: 'forwards' });
  }
  function ghostOut() {   // the hand fades where it is (a tiny drift away); returns the duration
    if (IN.el) IN.el.animate({ opacity: [CFG.introAlpha, 0], transform: [tl(IN.x, IN.y), tl(IN.x + 4, IN.y + 6)] }, { duration: CFG.introFadeMs, easing: 'ease-in-out', fill: 'forwards' });
    return CFG.introFadeMs;
  }
  function ghostGone() {   // the ghost removed at once; nothing else to undo (the brain was never held)
    IN.tok++; clearTimeout(IN.tm);
    if (IN.el) { IN.el.remove(); IN.el = null; }
  }
  function ppaClient() { const bi = ppaCell(); if (bi < 0) return null; const r = canvas.getBoundingClientRect(); return [r.left + (bi % cols + 0.5) * cw, r.top + (Math.floor(bi / cols) + 0.5) * ch]; }   // a lit PPA cell near the blob's middle
  function ppaNear(p, rad) {   // the middle of the PPA cells now lit within rad px of client point p (a few mean-shift steps: it stays on the same blob as the brain turns),
    if (!ppaCount || !cellPpa) return null;   // put on a lit cell (the nearest one if that middle is not lit); null if none is near
    const r = canvas.getBoundingClientRect(), L = [];
    for (let i = 0; i < cellPpa.length; i++) if (cellPpa[i]) L.push(i);
    const cx = i => r.left + (i % cols + 0.5) * cw, cy = i => r.top + (Math.floor(i / cols) + 0.5) * ch;
    let x = p[0], y = p[1];
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0, n = 0;
      for (const i of L) { const X = cx(i), Y = cy(i); if (Math.hypot(X - x, Y - y) <= rad) { sx += X; sy += Y; n++; } }
      if (!n) return null; x = sx / n; y = sy / n;
    }
    const c = Math.floor((x - r.left) / cw), w = Math.floor((y - r.top) / ch);
    if (c >= 0 && c < cols && w >= 0 && w < rows && cellPpa[w * cols + c]) return [x, y];
    let bi = -1, bd = 1e9; for (const i of L) { const d = Math.hypot(cx(i) - x, cy(i) - y); if (d < bd) { bd = d; bi = i; } }
    return [cx(bi), cy(bi)];
  }
  function ppaDist(x, y) { if (!ppaCount || !cellPpa) return null; const r = canvas.getBoundingClientRect(); let bd = 1e9; for (let i = 0; i < cellPpa.length; i++) if (cellPpa[i]) bd = Math.min(bd, Math.hypot(r.left + (i % cols + 0.5) * cw - x, r.top + (Math.floor(i / cols) + 0.5) * ch - y)); return bd; }   // (tests)
  async function followLeg(P0, track, rest, live, fade) {   // glide to a moving target and rest on it, aiming each frame at where it is now (lightly smoothed;
    // track(T) gives its current point or null). Ends early if it is gone for 3 frames; fade: then fades out in place, still on the target
    const frame = () => new Promise(r => requestAnimationFrame(r));
    for (const a of IN.el.getAnimations()) if (a.effect && a.effect.getKeyframes().some(k => k.transform)) a.cancel();   // a previous WAAPI glide must not override the per-frame position
    IN.el.style.transform = tl(IN.x, IN.y);
    const A = [IN.x, IN.y], ms = clamp(870 + Math.hypot(P0[0] - A[0], P0[1] - A[1]) * 1.15, 1100, 1900), t0 = now();
    let S = P0.slice(), T = P0, lost = 0, tp = t0, fT0 = 0;
    while (true) {
      await frame(); if (!live()) return false;
      const t = now(), el = t - t0;
      if (!fT0 && (el >= ms + rest || lost >= 3)) { if (!fade) return true; fT0 = t; IN.el.animate({ opacity: [CFG.introAlpha, 0] }, { duration: CFG.introFadeMs, easing: 'ease-in-out', fill: 'forwards' }); }
      if (fT0 && t - fT0 >= CFG.introFadeMs) return true;
      const V = lost >= 3 ? null : track(T);
      if (!V) lost++; else { lost = 0; T = V; }   // (gone for 3 frames: the leg ends; it stays where it is)
      const f = 1 - Math.exp(-(t - tp) / CFG.introFollowMs); tp = t; S[0] += (T[0] - S[0]) * f; S[1] += (T[1] - S[1]) * f;
      let x = S[0], y = S[1];
      if (el < ms) {   // the glide: the same slight arc and ease-in-out as the other legs, its end following the target
        const e = 0.5 - 0.5 * Math.cos(Math.PI * el / ms), dx = S[0] - A[0], dy = S[1] - A[1], cxp = (A[0] + S[0]) / 2 - dy * 0.08, cyp = (A[1] + S[1]) / 2 + dx * 0.08;
        const a = (1 - e) * (1 - e), b = 2 * e * (1 - e), c = e * e; x = a * A[0] + b * cxp + c * S[0]; y = a * A[1] + b * cyp + c * S[1];
      }
      if (lost < 3) { IN.x = x; IN.y = y; IN.el.style.transform = tl(x, y); }
    }
  }
  function nameClient() { const r = nmEl.getBoundingClientRect(); return [r.left + r.width * 0.45, r.top + r.height * 0.6]; }
  const boxAt = l => { const r = scene.getBoundingClientRect(); return [r.left + l.box.x + l.box.w * 0.5, r.top + l.box.y + Math.min(l.box.h * 0.45, 22)]; };   // on the box's text, not its chevron
  const boxReady = l => l.shown && l.box.alpha > 0.6 && l.u >= 1 && !l.open && !l.oa && !l.crossing && !l.popT0 && inView(boxAt(l));
  function introBox(F) {   // a rolled-up box in full view, not yet opened this visit, the one nearest F
    const c = LB.filter(l => !l.opened && boxReady(l)), d = l => Math.hypot(boxAt(l)[0] - F[0], boxAt(l)[1] - F[1]);
    const l = c.sort((p, q) => d(p) - d(q))[0];
    return l ? { l, P: boxAt(l) } : null;
  }
  async function introRun(skipPpa) {   // one run: the next hints in order (PPA -> name -> box), each leg skipped if found meanwhile or not in view
    const tok = ++IN.tok, live = () => IN.tok === tok, pause = ms => new Promise(r => { IN.tm = setTimeout(r, ms); }), R = CFG.introRestMs;
    IN.st = 'run'; IN.kind = IN.kind || handKind(); let faded = false;
    for (const k of HINTS) {
      if (isFound(k) || IN.hinted.has(k) || (k === 'ppa' && skipPpa)) continue;
      let P = null, B = null;
      if (k === 'ppa') P = ppaCount >= 3 ? inView(ppaClient()) : null;
      else if (k === 'name') P = inView(nameClient());
      else {
        if (LB.some(l => l.shown)) IN.step = 'settle'; for (let i = 0; i < 12 && LB.some(l => l.shown) && labelsBusy(); i++) { await pause(100); if (!live()) return; }   // the boxes come to rest first (appearing, typing, gliding aside; briefly: the brain keeps turning)
        B = introBox(IN.el ? [IN.x, IN.y] : handAt()); P = B && B.P;
      }
      if (!P) continue;
      if (!IN.shown) { if (!introStore()) { introEnd('skip'); return; } IN.shown = true; }   // the first hint marks the intro as seen
      IN.hinted.add(k); IN.step = k; if (B) IN.box = B.l.id;
      if (!IN.el) {   // the hand appears: beside the real pointer for a box, else from the lower right (or left) of the first target
        let S;
        if (B) { const M0 = handAt(), d = Math.hypot(P[0] - M0[0], P[1] - M0[1]); S = d > 96 ? [M0[0] + (P[0] - M0[0]) * 48 / d, M0[1] + (P[1] - M0[1]) * 48 / d] : [clamp(P[0] + 60, 30, innerWidth - 40), clamp(P[1] + 40, 30, innerHeight - 40)]; }
        else { S = [clamp(P[0] + 120, 30, innerWidth - 40), clamp(P[1] + 80, 30, innerHeight - 40)]; if (Math.hypot(S[0] - P[0], S[1] - P[1]) < 60) S[0] = clamp(P[0] - 120, 30, innerWidth - 40); }
        ghostIn(S);
      }
      if (k === 'ppa') { const rad = Math.max(36, 4 * cw); if (!(await followLeg(P, T => { const Q = ppaNear(T, rad); return Q && inView(Q); }, R[0], live, false))) return; continue; }   // follows the turning PPA
      if (k === 'name') { await pause(glide(P)); if (!live()) return; await pause(R[1]); if (!live()) return; continue; }   // the name does not move
      const l = B.l, onIt = () => l.shown && l.box.alpha > 0.6 && !l.open && !l.oa && !l.crossing ? inView(boxAt(l)) : null;   // a box may still glide a little as the brain turns:
      if (!(await followLeg(P, onIt, R[2], live, true))) return;   // the hand follows its text, rests and fades out on it (the box is the last hint)
      faded = true;
    }
    if (IN.el && !faded) { IN.step = 'out'; await pause(ghostOut()); if (!live()) return; }
    ghostGone(); IN.step = ''; IN.last = now();   // the next hints (if any) wait for stillness again
    if (todo().length) { IN.st = 'wait'; introWait(); } else introEnd('done');
  }
  function introStop() {   // real input while the hand shows: it goes at once; nothing else to undo (it showed nothing). The other hints wait again.
    if (IN.st !== 'run') return;
    ghostGone(); IN.step = ''; IN.st = 'wait'; introWait();
  }
  if (window.i18n) window.i18n.onChange(() => introStop());
  const easeOutBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const labelsBusy = () => typers.size > 0 || ppaOff[0] !== 0 || ppaOff[1] !== 0 || (PSY_L.shown && amyS !== amyH) || LB.some(l => l.u !== l.tgt || l.popT0 || now() - l.swapT < 400 || l.oa !== (l.open ? 1 : 0) || l.as !== l.asT || (l.shown && (Math.abs(l.sx - l.fx) > CFG.snapPx || Math.abs(l.sy - l.fy) > CFG.snapPx)));
  function hideL(l) {
    l.box.alpha = 0; l.shown = false; l.snap = true; l.side = undefined; l.rank = undefined; l.crossing = false; l.swapT = -1e9; l.solid = false;
    l.el.style.visibility = 'hidden'; l.el.style.opacity = 0; l.ln.style.opacity = 0; l.dot.style.opacity = 0; l.lnS.style.opacity = 0; l.dotS.style.opacity = 0; dropCur(l.el);
    if (l.inside) { l.lnIn.style.opacity = 0; l.lnInS.style.opacity = 0; l.dot2.style.opacity = 0; }
  }
  // PPA pointer: continuous like the bio anchors. Each frame: per hemisphere, the projected PPA vertices averaged with weights = smoothstep of how much
  // their normal faces the viewer, times a z-buffer visibility term; the pointer follows one hemisphere (switch only when the other side is CFG.ppaSwitch
  // times stronger) and glides across after a switch. Opacity follows the weight sum (no cell counting, so no steps).
  let PV = null, ppaLast = null, ppaHold = false, ppaH = 0, ppaW = 0, ppaOn = false, ppaT = null, ppaOff = [0, 0];
  const PPA_TAPS = [[0, 0, 0.2], [-1, -1, 0.1], [1, -1, 0.1], [-1, 1, 0.1], [1, 1, 0.1], [-2, 0, 0.1], [2, 0, 0.1], [0, -2, 0.1], [0, 2, 0.1]];
  const smooth01 = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
  function ppaFace(R, i) { const j = i * 3; return smooth01((R[2][0] * M.nrm[j] + R[2][1] * M.nrm[j + 1] + R[2][2] * M.nrm[j + 2] - 0.2) / 0.3); }
  function ppaTrack(R, dt) {
    if (!PV) { PV = [[], []]; for (let i = 0; i < M.nv; i++) if (M.ppa[i]) PV[i < 10242 ? 0 : 1].push(i); ppaH = PV[0].length >= PV[1].length ? 0 : 1; }
    const sc = SC(), S = [0, 0], C = [[0, 0], [0, 0]];
    for (let h = 0; h < 2; h++) for (const i of PV[h]) {
      let w = ppaFace(R, i); if (!w) continue;
      const j = i * 3, x = M.pos[j], y = M.pos[j + 1], z = M.pos[j + 2], P = projP(R, x, y, z);
      if (zb && CFG.ppaOcclude) {   // hidden behind other surface (e.g. the other hemisphere)? visibility per z-buffer sample fades over 3..10 mm of depth difference, bilinear between the 4 nearest samples (no pops as the vertex crosses a sample)
        const vz = R[2][0] * x + R[2][1] * y + R[2][2] * z; let vis = 0;
        for (const [ox, oy, ow] of PPA_TAPS) {   // centre + 8 taps 1-2 samples away: a soft footprint, so a silhouette edge crossing one sample moves the weight only a little
          const fx = P[0] / cw * SX - 0.5 + ox, fy = (P[1] / ch + pad) * SY - 0.5 + oy, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          for (let q = 0; q < 4; q++) {
            const xx = x0 + (q & 1), yy = y0 + (q >> 1), bw = ((q & 1) ? tx : 1 - tx) * ((q >> 1) ? ty : 1 - ty); if (!bw) continue;
            const d = (xx >= 0 && yy >= 0 && xx < W && yy < H) ? zb[yy * W + xx] - vz : 0;
            vis += ow * bw * (d <= 3 ? 1 : d >= 10 ? 0 : 1 - (d - 3) / 7);
          }
        }
        w *= vis; if (!w) continue;
      }
      S[h] += w; C[h][0] += w * P[0]; C[h][1] += w * P[1];
    }
    ppaLast = [0, 1].map(h => ({ w: S[h], x: S[h] ? C[h][0] / S[h] : null, y: S[h] ? C[h][1] / S[h] : null }));
    const o = 1 - ppaH;
    // click-to-centre hold: go to the left PPA (hemisphere 0) only once it is well visible (full label weight, >= 1/4 of the right side); until then
    // follow whatever side is visible, so the label never vanishes mid-turn. Leave hemisphere 0 only if it has faded to half the full weight (hysteresis).
    const flip = ppaHold ? (ppaH === 1 ? S[0] >= CFG.ppaFullW && S[0] >= 0.25 * S[1] : S[0] < 0.5 * CFG.ppaFullW && S[1] > CFG.ppaSwitch * S[0])
      : S[o] > 0 && S[o] > CFG.ppaSwitch * S[ppaH];
    if (flip) {   // switch hemisphere: keep the pointer where it is and glide to the new side
      if (ppaT && S[o] > 0 && S[ppaH] > 0) { const nt = [C[o][0] / S[o], C[o][1] / S[o]]; ppaOff = [ppaT[0] + ppaOff[0] - nt[0], ppaT[1] + ppaOff[1] - nt[1]]; } else ppaOff = [0, 0];
      ppaH = o;
    }
    if (!PPA_L.shown) ppaOff = [0, 0];   // nothing to glide while the PPA label is hidden
    ppaW = S[ppaH];
    ppaT = ppaW > 0 ? [C[ppaH][0] / ppaW, C[ppaH][1] / ppaW] : null;
    const od = Math.hypot(ppaOff[0], ppaOff[1]), step = reduced ? od : Math.min(od * (1 - Math.exp(-dt / CFG.ppaGlideMs)), CFG.ppaGlidePxMs * dt);   // exponential glide, speed-capped
    if (od - step < CFG.snapPx) ppaOff = [0, 0]; else { const k = (od - step) / od; ppaOff[0] *= k; ppaOff[1] *= k; }
    ppaOn = ppaOn ? ppaW > 0.3 : ppaW > 1.5;   // label target on/off with hysteresis (no on/off flicker at the edge of visibility)
  }
  const ppaPt = () => ppaT && [ppaT[0] + ppaOff[0], ppaT[1] + ppaOff[1]];
  function placeLabels(R) {
    if (!M) return;
    const tn = now(), dt = Math.min(64, tn - lastLbl); lastLbl = tn;
    ppaTrack(R, dt); amyTrack(R, dt);
    const CW = cols * cw, CH = (rows - 2 * pad) * ch, all = showAll(), kS = 1 - Math.exp(-dt / CFG.smoothMs);
    const vis = [];
    for (const l of LB) {
      const tgt = l.id === 'ppa' ? (found && ppaOn ? 1 : 0) : ((all || l.hot) ? 1 : 0);
      if (tgt !== l.tgt) {
        l.tgt = tgt;
        if (tgt) {
          l.snap = true; l.start = tn + (l.hot && !all ? 0 : l.delay); typeLabel(l);
          if (l.id === 'ppa' && !popped) { popped = true; if (!reduced) l.popT0 = tn; openLbl(l, false, true); }   // first discovery: the PPA box pops up already open, once
        } else { endTyping(l.bEl); endTyping(l.sEl); closeLbl(l); }
      }
      if (reduced) l.u = tgt; else if (l.u < tgt) { if (tn >= l.start) l.u = Math.min(1, l.u + dt / 450); } else if (l.u > tgt) l.u = Math.max(0, l.u - dt / 225);
      if (l.u <= 0) { if (!l.tgt && (l.oa || l.open)) { closeLbl(l); l.oa = 0; restLbl(l); } l.as = l.asT = 0; hideL(l); continue; }   // (opened just before it appears: it stays open)
      {   // open amount (the box height glides between its rest and open sizes) and, on phones, stepping aside for an open strip neighbour
        const ot = l.open ? 1 : 0;
        if (l.oa !== ot) { l.oa = reduced ? ot : ot > l.oa ? Math.min(1, l.oa + dt / CFG.openMs) : Math.max(0, l.oa - dt / CFG.closeMs); if (!l.oa && !l.open) restLbl(l); else setH(l); if (l.inside) dirty = true; }   // the amygdala layer follows
        const at = strips && openL && openL !== l && openL.grp === l.grp && openL.shown ? 1 : 0;
        if (at !== l.asT) { l.asT = at; if (!at) l.snap = true; }   // back: it reappears in its own slot (it was invisible)
        if (l.as !== at) l.as = reduced ? at : at > l.as ? Math.min(1, l.as + dt / CFG.asideMs) : Math.max(0, l.as - dt / CFG.asideBackMs);
        if (l.as >= 1) { hideL(l); continue; }
      }
      if (!l.w) { l.w = l.el.offsetWidth; l.h_ = l.el.offsetHeight; }
      const grow = Math.min(1, l.u * 2); let A, alpha;
      if (l.id === 'ppa') {
        A = ppaPt(); if (!A) { hideL(l); continue; }
        alpha = clamp((ppaW - 2.5) / (CFG.ppaFullW - 2.5), 0, 1) * grow;   // weight below 2.5 = a few grazing vertices, no orange cells: no label
      } else {
        const a = l.a; if (!a) continue;
        A = projP(R, a[0], a[1], a[2]);
        alpha = (l.inside ? 1 : clamp((facing(R, l.n) - 0.05) / 0.3, 0, 1)) * grow;   // the amygdala dot (inside) is always pointed at, from the nearer side
      }
      if (alpha <= 0.01) { hideL(l); continue; }
      l.A = A; l.alpha = alpha; l.shown = true; vis.push(l);
    }
    if (!vis.length) return;
    const br = rect || { x0: CW * 0.1, y0: 0, x1: CW * 0.9, y1: CH };
    const G = strips ? CFG.lblStripGap : CFG.lblStackGap, vlo = CFG.lblEdge - sceneTop, vhi = innerHeight - CFG.lblEdge - sceneTop, cols_ = [];   // first screen, scene coordinates
    if (strips) {   // two stacked strips: group 0 above the canvas, group 1 below
      for (let g = 0; g < 2; g++) {
        let cur = g ? CH + 6 : -6; const col = [];
        for (const l of vis) if (l.grp === g && !l.asT) {   // a box stepping aside for its open neighbour keeps where it is while it fades
          l.fy = g ? cur : cur - l.h_; cur += g ? l.h_ + G : -(l.h_ + G);
          l.fx = clamp(l.A[0] - l.w / 2, 4 - sceneLeft, vw - 4 - sceneLeft - l.w);
          if (g) col.push(l); else col.unshift(l);
        }
        cols_.push(col);
      }
    } else {        // side gutters, outside the brain extent: committed side (hysteresis), stable order, least-squares packing with a min gap
      const cx = (br.x0 + br.x1) / 2, hys = CFG.sideHys * (br.x1 - br.x0), sides = [[], []];
      for (const l of vis) {
        const ax = l.A[0];
        if (l.side === undefined) l.side = ax < cx ? 0 : 1;
        else if (l.id === 'ppa' && ppaHold) { /* clicked PPA label: keeps its side while the brain turns under it (no fading cross-over mid-turn) */ }
        else if (l.side === 0 && ax > cx + hys) { l.side = 1; l.rank = undefined; l.crossing = !l.snap; }
        else if (l.side === 1 && ax < cx - hys) { l.side = 0; l.rank = undefined; l.crossing = !l.snap; }
        sides[l.side].push(l);
      }
      sides.forEach((arr, si) => {
        const ranked = arr.filter(l => l.rank !== undefined).sort((p, q) => p.rank - q.rank);
        for (const l of arr) if (l.rank === undefined) { let i = 0; while (i < ranked.length && ranked[i].A[1] < l.A[1]) i++; ranked.splice(i, 0, l); }
        for (let i = 1; i < ranked.length; i++) for (let j = i; j > 0 && ranked[j - 1].A[1] - ranked[j].A[1] > CFG.orderHys; j--) {
          const t = ranked[j]; ranked[j] = ranked[j - 1]; ranked[j - 1] = t;
          for (const q of [t, ranked[j]]) if (!q.snap && !reduced && !(tn - q.swapT < 360)) q.swapT = tn;   // order swap: both fade out, jump to their new slots, fade in (they never slide through each other)
        }
        ranked.forEach((l, i) => { l.rank = i; l.ty = l.A[1] - l.h_ / 2; });
        // bounds: the brain's height; a taller stack may use the first screen above and below it (centred on the brain, then shifted inside)
        const tot = ranked.reduce((s_, l) => s_ + l.h_, 0) + G * Math.max(0, ranked.length - 1);
        let lo = 0, hi = CH;
        if (tot > CH) { lo = (CH - tot) / 2; hi = lo + tot; if (hi > vhi) { lo -= hi - vhi; hi = vhi; } if (lo < vlo) { hi += vlo - lo; lo = vlo; } }
        spread(ranked, G, lo, Math.max(hi, lo + tot), 'ty', 'fy');
        for (const l of ranked) l.fx = si === 0 ? br.x0 - CFG.lblGap - l.w : br.x1 + CFG.lblGap;
        cols_.push(ranked);
      });
    }
    for (const l of vis) {   // smooth flow towards the slot, then sprout on top
      const sw_ = tn - l.swapT < 360 ? tn - l.swapT : -1;   // order-swap fade: out 0..150 ms (holding still), jump, in 150..360 ms
      if (l.snap || reduced) { l.sx = l.fx; l.sy = l.fy; l.snap = false; l.crossing = false; }
      else if (sw_ >= 0 && sw_ < 150) { /* fading out in place */ }
      else if (sw_ >= 150 && !l.swJ) { l.sx = l.fx; l.sy = l.fy; l.crossing = false; }
      else {
        const k = l.crossing ? 1 - Math.exp(-dt / CFG.crossMs) : kS;
        let mx = (l.fx - l.sx) * k, my = (l.fy - l.sy) * k;
        { const cap = (l.crossing ? CFG.crossPxMs : CFG.glidePxMs) * dt, d = Math.hypot(mx, my); if (d > cap) { mx *= cap / d; my *= cap / d; } }   // speed limit: a label that has to make room (or slide across) never darts
        l.sx += mx; l.sy += my;
        if (Math.abs(l.fx - l.sx) < CFG.snapPx) l.sx = l.fx;
        if (Math.abs(l.fy - l.sy) < CFG.snapPx) l.sy = l.fy;
        if (l.crossing && Math.abs(l.fx - l.sx) <= 8) l.crossing = false;
      }
      l.swJ = sw_ >= 150; l.swF = sw_ < 0 ? 1 : sw_ < 150 ? 1 - sw_ / 150 : (sw_ - 150) / 210;
      const e = easeOutBack(l.u), ey = 1 - Math.pow(1 - l.u, 3), w = l.w, h = l.h_, A = l.A;   // vertical sprout without overshoot (no bounce into a neighbour)
      l.dx = A[0] + (l.sx + w / 2 - A[0]) * e - w / 2; l.dy = A[1] + (l.sy + h / 2 - A[1]) * ey - h / 2;
    }
    // no overlap, no teleport. "Settled" boxes (fully grown, opaque, not crossing / swapping, and clear of the others when they settled) glide
    // with a capped speed towards slots that never overlap; a last pass per gutter / strip keeps them >= G apart (tiny nudges only, since their
    // slots are consistent). Every other box (sprouting, fading, crossing, swapping) is never allowed to push a settled one: it dims to
    // 0.3 x as it comes closer than G to any box, and settles once it is clear.
    for (const l of vis) { l.cand = !l.crossing && !(tn - l.swapT < 360) && l.u >= 1 && l.alpha > 0.5 && !l.as && !l.asT; if (!l.cand) l.solid = false; }   // demote first: a box that starts crossing / swapping this frame must not push the others
    for (const col of cols_) {
      const H_ = col.filter(l => l.solid);
      if (H_.length < 2) continue;
      let lo = Infinity, hi = -Infinity; for (const l of H_) { lo = Math.min(lo, l.fy, l.dy); hi = Math.max(hi, l.fy + l.h_, l.dy + l.h_); }
      if (!strips) { lo = Math.min(lo, Math.max(vlo, Math.min(0, lo))); hi = Math.max(hi, vhi); }
      spread(H_, G, lo, hi, 'dy', 'dy');
      for (const l of H_) if (l.u >= 1) l.sy = l.dy;   // the glide continues from where the box really is
    }
    const lowAt = 0.7 * G;
    for (const l of vis) {
      if (l.solid) { l.ovF = 1; continue; }
      let gap = Infinity;
      for (const o of vis) if (o !== l && o.dx < l.dx + l.w && o.dx + o.w > l.dx) gap = Math.min(gap, Math.max(o.dy, l.dy) - Math.min(o.dy + o.h_, l.dy + l.h_));
      l.ovF = clamp(0.3 + 0.7 * (gap - lowAt) / (G - lowAt), 0.3, 1);
      if (l.cand && gap >= G - 0.5) l.solid = true;
    }
    // under the open language pop-up an area box fades back (to 15%) and returns when it closes, gliding over ~0.2 s (Alex chose variant B, 2026-11-18)
    const lpR = window.i18n && window.i18n.popRect ? window.i18n.popRect() : null;
    for (const l of vis) { let tg = 1; if (lpR) { const q = l.el.getBoundingClientRect(); if (q.width && q.right > lpR.left && q.left < lpR.right && q.bottom > lpR.top && q.top < lpR.bottom) tg = 0.15; } l.lpF = l.lpF == null ? tg : l.lpF + (tg - l.lpF) * 0.25; if (Math.abs(tg - l.lpF) < 0.01) l.lpF = tg; }
    for (const l of vis) {
      const dp = window.devicePixelRatio || 1, w = l.w, h = l.h_, A = l.A, y = Math.round(l.dy * dp) / dp, al = l.alpha * (l.crossing ? CFG.crossAlpha : 1) * l.swF * l.ovF * l.lpF * (1 - l.as);
      let x = Math.round(l.dx * dp) / dp;
      const ps = popScale(l, tn), bw = w * ps, bh = h * ps, by = y + h * (1 - ps) / 2;   // the box as drawn (pop scales about its centre)
      x = clamp(x, (bw - w) / 2 - sceneLeft, vw - sceneLeft - (bw + w) / 2);   // never past the window edge (sprout overshoot, pop)
      const bx = x + w * (1 - ps) / 2;
      Object.assign(l.box, { x: bx, y: by, w: bw, h: bh, alpha: al, A });
      l.el.style.visibility = 'visible'; l.el.style.opacity = al; l.el.style.transform = 'translate(' + x + 'px,' + y + 'px)' + (ps !== 1 ? ' scale(' + ps.toFixed(4) + ')' : '');
      let ex, ey;   // leader end: on the box's nearest edge at its current (glided, pushed, scaled) position, inside its extent
      const mY = Math.min(6, bh / 2), mX = Math.min(6, bw / 2);
      if (strips) { ex = clamp(A[0], bx + mX, bx + bw - mX); ey = l.grp ? by : by + bh; } else { ex = l.side === 0 ? bx + bw : bx; ey = clamp(A[1], by + mY, by + bh - mY); }
      const ln = l.ln; let P = A;   // P: where the leader enters the brain (inside anchors only; the line is dotted from there to the dot)
      if (l.inside) { P = entryPt(ex, ey, A); const dI = 'M' + P[0].toFixed(2) + ' ' + P[1].toFixed(2) + 'L' + A[0].toFixed(2) + ' ' + A[1].toFixed(2), dS = 'M' + (P[0] + 1).toFixed(2) + ' ' + (P[1] + 1).toFixed(2) + 'L' + (A[0] + 1).toFixed(2) + ' ' + (A[1] + 1).toFixed(2);
        l.lnIn.setAttribute('d', dI); l.lnIn.style.opacity = al * 0.8; l.lnInS.setAttribute('d', dS); l.lnInS.style.opacity = al * 0.8;
        l.dot2.setAttribute('cx', A[0].toFixed(2)); l.dot2.setAttribute('cy', A[1].toFixed(2)); l.dot2.style.opacity = al; }
      ln.setAttribute('x1', P[0].toFixed(2)); ln.setAttribute('y1', P[1].toFixed(2)); ln.setAttribute('x2', ex.toFixed(2)); ln.setAttribute('y2', ey.toFixed(2)); ln.style.opacity = al * 0.8;
      l.dot.setAttribute('cx', A[0].toFixed(2)); l.dot.setAttribute('cy', A[1].toFixed(2)); l.dot.style.opacity = al;
      l.lnS.setAttribute('d', 'M' + (P[0] + 1).toFixed(2) + ' ' + (P[1] + 1).toFixed(2) + 'L' + (ex + 1).toFixed(2) + ' ' + (ey + 1).toFixed(2)); l.lnS.style.opacity = al * 0.8;
      l.dotS.setAttribute('cx', (A[0] + 1).toFixed(2)); l.dotS.setAttribute('cy', (A[1] + 1).toFixed(2)); l.dotS.style.opacity = al;
    }
  }
  // where the segment from the box end (ex, ey) to the anchor A (scene px) first enters the brain's drawn extent (a covered cell), walked in
  // half-cell steps from the box; A itself if it never does
  function entryPt(ex, ey, A) {
    const dx = A[0] - ex, dy = A[1] - ey, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (0.5 * Math.min(cw, ch))));
    for (let k = 0; k <= n; k++) {
      const x = ex + dx * k / n, y = ey + dy * k / n, c = Math.floor(x / cw), r = Math.floor(y / ch) + pad;
      if (c >= 0 && r >= 0 && c < cols && r < rows && cellD[r * cols + c] >= 0) return [x, y];
    }
    return A;
  }
  // 1-D packing with an order constraint: move the boxes of arr (top to bottom) as little as possible (least squares) from arr[i][key] so that
  // consecutive boxes are >= G apart, inside [lo, hi] when the stack fits (else from lo down). Writes arr[i][out].
  function spread(arr, G, lo, hi, key, out) {
    const B = [];
    for (const l of arr) {
      let b = { m: [l], sum: l[key], n: 1, len: l.h_ }; b.s = clamp(b.sum, lo, Math.max(lo, hi - b.len));
      while (B.length) {
        const p = B[B.length - 1]; if (p.s + p.len + G <= b.s + 1e-6) break;
        B.pop(); const off = p.len + G;
        b = { m: p.m.concat(b.m), sum: p.sum + b.sum - off * b.n, n: p.n + b.n, len: p.len + G + b.len };
        b.s = clamp(b.sum / b.n, lo, Math.max(lo, hi - b.len));
      }
      B.push(b);
    }
    for (const b of B) { let y = b.s; for (const l of b.m) { l[out] = y; y += l.h_ + G; } }
  }
  function popScale(l, tn) {   // the PPA label's one-time pop (was a CSS animation; done here so the leader can follow the box's real size): .6 -> 1.08 (60%) -> 1, ease-out, 500 ms
    if (!l.popT0) return 1;
    const u = (tn - l.popT0) / 500; if (u >= 1) { l.popT0 = 0; return 1; }
    const eo = v => 1 - (1 - v) * (1 - v);
    return u < 0.6 ? 0.6 + 0.48 * eo(u / 0.6) : 1.08 - 0.08 * eo((u - 0.6) / 0.4);
  }

  // ---- loop ----
  let lastT = now(), spinT0 = 0, spinV = 0, mouseAt = null;   // spinT0: when the idle spin last (re)started (0: not spinning); spinV: its speed now (rad/ms); mouseAt: the mouse over the canvas (client px)
  function tick(t) {
    const dt = Math.min(64, t - lastT); lastT = t;
    if (ctr) {   // click-to-centre rotation
      const u = Math.min(1, (now() - ctr.t0) / CFG.centerMs), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      yaw = ctr.y0 + ctr.dy * e; pitch = ctr.p0 + (ctr.p1 - ctr.p0) * e; vYaw = vPitch = 0; nod = 0; nodT0 = 0; dirty = true; if (u >= 1) ctr = null;
    }
    if (!drag && (Math.abs(vYaw) > 1e-4 || Math.abs(vPitch) > 1e-4)) {
      yaw += vYaw * dt / 16; pitch = clampP(pitch + vPitch * dt / 16); const f = Math.pow(0.94, dt / 16); vYaw *= f; vPitch *= f; dirty = true;
    } else if (!(drag && moved) && !ctr && !reduced && t - lastInteract > CFG.spinResumeMs) {   // idle spin: never held (not by hovers, boxes, menus or the intro hand),
      // only by the visitor's own turning (drag, arrow keys) and a label's centring turn; each time it (re)starts it eases in from a standstill
      if (!spinT0) spinT0 = t; const u = Math.min(1, (t - spinT0) / CFG.spinRampMs);
      spinV = CFG.idleSpin * u * u * (3 - 2 * u); yaw += spinV * dt; dirty = true; ppaHold = false;
    } else { spinT0 = 0; spinV = 0; }
    if (swT0) { const u = (now() - swT0) / 1400; if (u >= 1) { sw = 0; swT0 = 0; dirty = true; } else if (u >= 0) { sw = 0.35 * Math.sin(2 * Math.PI * u) * (1 - u); dirty = true; } }
    if (hoverPpa && infoUntil && now() > infoUntil) setPpa(false);
    if (hotUntil && now() > hotUntil && !lblOver) clearHot();
    if (openL && !openL.hov && !openL.foc && now() > openL.openUntil) closeLbl(openL);   // the linger after a hover / focus / click / tap ends
    if (typers.size) stepTypers(now());
    if (nodT0) {
      const up = CFG.nodUpMs, hold = CFG.nodHoldMs, down = CFG.nodDownMs;
      const el = now() - nodT0;
      if (el >= up + hold + down || (drag && moved) || now() - lastInteract < 1000) { foldNod(); nextNod = now() + CFG.nodEvery; }
      else if (el < up) { const v = el / up; nod = CFG.nodPitch * (1 - Math.pow(1 - v, 3)); }
      else if (el < up + hold) nod = CFG.nodPitch;
      else { const v = (el - up - hold) / down; nod = CFG.nodPitch * 0.5 * (1 + Math.cos(Math.PI * v)); }
      dirty = true;
    } else if (M && !found && !reduced && !(drag && moved) && now() - lastInteract > 2500 && now() > nextNod && !hoverPpa) nodT0 = now();
    if (dirty && M) { dirty = false; render(); if (hoverPpa && !infoUntil && mouseAt && !drag && !hit(mouseAt[0], mouseAt[1])) setPpa(false); }   // the PPA turned away from under a resting mouse
    else if (M) { if (breathing() && !reduced && t - lastPulse >= 1000 / CFG.ppaPulseFps - 2) { lastPulse = t; drawGlow(); } if (labelsBusy()) placeLabels(rotation()); }
    if (M) glitchTick(t);   // idle: a few comparisons; WebGL only while a glitch runs
    requestAnimationFrame(tick);
  }

  // ---- glitch: for a moment the ASCII brain shows the real brain underneath, like a TV losing its signal ----
  // A WebGL canvas (#photo) over the scene draws the same mesh (fsaverage6 when loaded, else the ASCII mesh itself) with the same rotation and
  // projection as the ASCII frame: css x = W/2 + X*s, y = H/2 - Y*s with s = scale*cw px per mm (orthographic, like the z-buffer above), so
  // silhouette and folds sit exactly where the glyphs are, also while the brain turns (it is drawn every frame from rotation()). Natural tissue
  // colours only (no PPA glow, palette, accent or amygdala); the glitch look (torn slices, RGB split, scanlines, noise) is a second pass.
  // Idle cost: none. The context is created at the first glitch (or never), the canvas is display:none between glitches and nothing is drawn.
  let G = null, glA = null, glNext = 0, glHdRaw = null, glHdReq = false, glHold = null, glWarming = false, glFreeT = 0;
  const glFlag = (() => { try { return new URLSearchParams(location.search).get('glitch') === '1'; } catch (e) { return false; } })();
  if (window.__glitchOff) CFG.glitch = false;   // test harness (init script): no unprompted glitches in the other tests
  const glStats = { lastDur: 0, probeMs: -1, tier: -1, scale: 1, inits: 0, frames: 0, brainDraws: 0, glitches: 0, aborted: 0, skipped: 0, deferred: 0, tierDowns: 0, freed: 0, poseErr: 0, hd: false, hdBytes: 0, decodeMs: -1, setup: null, last: null, err: '' };
  const rnd = (a, b) => a + (b - a) * Math.random();
  function glGap() {   // normal(mean, SD) by Box-Muller, redrawn while under the minimum
    for (let i = 0; i < 100; i++) { const g = CFG.glitchGapMeanMs + CFG.glitchGapSdMs * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()); if (g >= CFG.glitchGapMinMs) return g; }
    return CFG.glitchGapMeanMs;
  }
  function glSchedule(first) {
    const t = now();
    if (glFlag) glNext = t + CFG.glitchViewMs[first ? 0 : 1];
    else if (first) glNext = t + rnd(CFG.glitchFirstMs[0], CFG.glitchFirstMs[1]);
    else glNext = t + glGap();
  }
  const glBlocked = () => !!(drag || IN.st === 'run' || document.hidden || !M);   // open / hovered / pinned boxes do not block it (Alex, 2026-11-16)
  function glitchTick(t) {
    if (glA) { if (!glHold && glBlocked()) { glStats.aborted++; glitchEnd(); } else glitchFrame(now()); return; }
    if (!CFG.glitch || reduced || !glNext) return;
    if (!(G && (G.ok || G.none)) && !glWarming && glNext - t < CFG.glitchPrefetchMs) glWarm();   // get ready a few seconds ahead, in idle moments
    if (t >= glNext) { if (glBlocked()) glNext = t + CFG.glitchRetryMs; else glitchStart(); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { clearTimeout(glFreeT); if (glNext && glNext - now() < 3000) glNext = now() + 3000; }   // no glitch the moment a tab comes back
    else glFreeT = setTimeout(glFree, CFG.glitchFreeHiddenMs);   // a long-hidden tab gives its GPU memory back (set up again before the next glitch)
  });
  const glLite = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };   // Save-Data or a 2G link: no extra download, the ASCII mesh is used
  async function glLoadHd() {   // fetch the fine mesh (~270 KB); decoded when needed (it is rebuilt from the ASCII mesh, see tools/build_glitch_mesh.py)
    glHdReq = true;
    try {
      const r = await fetch(CFG.glitchMesh); if (!r.ok) throw new Error('HTTP ' + r.status); let buf = await r.arrayBuffer(); glStats.hdBytes = buf.byteLength;
      const b0 = new Uint8Array(buf); if (b0[0] === 0x1f && b0[1] === 0x8b) buf = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      glHdRaw = buf; return true;
    } catch (e) { glStats.err = 'hd: ' + e.message; return false; }
  }
  // GPU vertex layout, 16 bytes: position i16 x3 (normalised to M.half), pad, normal i8 x3, pad, ambient occlusion, sulcal depth, curvature (+128), pad.
  // One part per hemisphere, so every index fits 16 bits (no OES_element_index_uint needed; less memory)
  function glPack(pos, idxParts, ext) {   // pos Float32 (mm), idxParts [{ idx: Uint16Array (local), v0, nv }], ext Uint8 (ao, dep per vertex)
    const nv = pos.length / 3, vb = new ArrayBuffer(nv * 16), i16 = new Int16Array(vb), i8 = new Int8Array(vb), u8 = new Uint8Array(vb), nrm = new Float32Array(nv * 3), lap = new Float32Array(nv * 3), cnt = new Uint16Array(nv), k = 32767 / M.half;
    for (const p of idxParts) {
      const ix = p.idx, o = p.v0;
      for (let t = 0; t < ix.length; t += 3) {
        const a = (ix[t] + o) * 3, b = (ix[t + 1] + o) * 3, c = (ix[t + 2] + o) * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
        nrm[a] += x; nrm[a + 1] += y; nrm[a + 2] += z; nrm[b] += x; nrm[b + 1] += y; nrm[b + 2] += z; nrm[c] += x; nrm[c + 1] += y; nrm[c + 2] += z;
        for (const [p0, p1, p2] of [[a, b, c], [b, c, a], [c, a, b]]) { lap[p0] += pos[p1] + pos[p2] - 2 * pos[p0]; lap[p0 + 1] += pos[p1 + 1] + pos[p2 + 1] - 2 * pos[p0 + 1]; lap[p0 + 2] += pos[p1 + 2] + pos[p2 + 2] - 2 * pos[p0 + 2]; cnt[p0 / 3] += 2; }
      }
    }
    const cv = new Float32Array(nv);
    for (let i = 0, j = 0; i < nv; i++, j += 3) {
      const l = Math.hypot(nrm[j], nrm[j + 1], nrm[j + 2]) || 1, nx = nrm[j] / l, ny = nrm[j + 1] / l, nz = nrm[j + 2] / l;
      cv[i] = -(lap[j] * nx + lap[j + 1] * ny + lap[j + 2] * nz) / (cnt[i] || 1);   // mean curvature (umbrella), + on crowns
      i16[i * 8] = Math.round(pos[j] * k); i16[i * 8 + 1] = Math.round(pos[j + 1] * k); i16[i * 8 + 2] = Math.round(pos[j + 2] * k);
      i8[i * 16 + 8] = Math.round(nx * 127); i8[i * 16 + 9] = Math.round(ny * 127); i8[i * 16 + 10] = Math.round(nz * 127);
      u8[i * 16 + 12] = ext[2 * i]; u8[i * 16 + 13] = ext[2 * i + 1];
    }
    let m = 0; for (let i = 0; i < nv; i += 7) m = Math.max(m, Math.abs(cv[i]));   // scale: ~ the largest (sampled) value
    const s = 127 / (0.6 * m || 1); for (let i = 0; i < nv; i++) u8[i * 16 + 14] = Math.max(1, Math.min(255, Math.round(cv[i] * s) + 128));
    return { vb, parts: idxParts };
  }
  function glDecodeHd() {   // the fine mesh from the ASCII mesh + the file: faces by 1-to-4 split, new vertices = middle of the parent edge + offset
    if (!glHdRaw) return null;
    const t0 = performance.now(), buf = glHdRaw, dv = new DataView(buf), b = new Uint8Array(buf);
    if (dv.getUint32(0, true) !== 0x32444842) { glStats.err = 'hd: bad file'; return null; }   // 'BHD2'
    const nmid = dv.getUint32(4, true), step = dv.getFloat32(8, true), N5 = M.nv / 2, nvH = N5 + nmid, n = 2 * nmid * 3, F5 = M.nf / 2;
    let o = 12; const res = (i => ((b[o + i] | (b[o + n + i] << 8)) << 16 >> 16) * step);
    const pos = new Float32Array(2 * nvH * 3), ext = new Uint8Array(2 * nvH * 2), aoO = o + 2 * n, depO = aoO + 2 * nvH, parts = [], key = new Map();
    for (let h = 0; h < 2; h++) {
      const P = h * nvH, idx = new Uint16Array(F5 * 12); let m = 0, w = 0;
      for (let i = 0; i < N5; i++) { const s = (h * N5 + i) * 3, d = (P + i) * 3; pos[d] = M.pos[s]; pos[d + 1] = M.pos[s + 1]; pos[d + 2] = M.pos[s + 2]; ext[(P + i) * 2 + 1] = M.depth[h * N5 + i]; }
      key.clear();
      const mid = (x, y) => {
        const kk = x < y ? x * N5 + y : y * N5 + x; let v = key.get(kk);
        if (v === undefined) {
          v = N5 + m; key.set(kk, v); const r = (h * nmid + m) * 3, d = (P + v) * 3, a = (P + x) * 3, c = (P + y) * 3;
          pos[d] = (pos[a] + pos[c]) / 2 + res(r); pos[d + 1] = (pos[a + 1] + pos[c + 1]) / 2 + res(r + 1); pos[d + 2] = (pos[a + 2] + pos[c + 2]) / 2 + res(r + 2);
          ext[(P + v) * 2 + 1] = b[depO + h * nmid + m]; m++;
        }
        return v;
      };
      for (let f = 0; f < F5; f++) {
        const t = (h * F5 + f) * 3, a = M.idx[t] - h * N5, bb = M.idx[t + 1] - h * N5, c = M.idx[t + 2] - h * N5;
        const ab = mid(a, bb), bc = mid(bb, c), ca = mid(c, a);
        idx[w++] = a; idx[w++] = ab; idx[w++] = ca; idx[w++] = ab; idx[w++] = bb; idx[w++] = bc; idx[w++] = ca; idx[w++] = bc; idx[w++] = c; idx[w++] = ab; idx[w++] = bc; idx[w++] = ca;
      }
      for (let i = 0; i < nvH; i++) ext[(P + i) * 2] = b[aoO + h * nvH + i];
      parts.push({ idx, v0: P, nv: nvH });
    }
    const mesh = glPack(pos, parts, ext); mesh.low = false; glStats.decodeMs = Math.round((performance.now() - t0) * 10) / 10; return mesh;
  }
  function glLow() {   // the ASCII mesh itself: ambient occlusion approximated from the sulcal depth
    const N5 = M.nv / 2, F5 = M.nf / 2, ext = new Uint8Array(M.nv * 2), parts = [];
    for (let i = 0; i < M.nv; i++) { ext[2 * i] = 255 - Math.round(M.depth[i] * 0.75); ext[2 * i + 1] = M.depth[i]; }
    for (let h = 0; h < 2; h++) { const idx = new Uint16Array(F5 * 3); for (let i = 0; i < idx.length; i++) idx[i] = M.idx[h * F5 * 3 + i] - h * N5; parts.push({ idx, v0: h * N5, nv: N5 }); }
    const mesh = glPack(M.pos, parts, ext); mesh.low = true; return mesh;
  }
  const GL_VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aE;uniform mat3 uR;uniform vec3 uK;uniform float uHalf;varying vec3 vN;varying vec3 vO;varying vec3 vE;' +
    'void main(){vec3 o=aP*uHalf,p=uR*o;vN=uR*aN;vO=o;vE=aE;gl_Position=vec4(p.x*uK.x,p.y*uK.y,-p.z*uK.z,1.0);}';   // aP: 16-bit, normalised to the mesh half-extent
  // tissue shader: albedo from sulcal depth / ambient occlusion / curvature, fine procedural texture and surface vessels (in brain space, so they turn
  // with it), wrap-around diffuse with a red subsurface bleed in the shadows, a sharp wet highlight plus a broad sheen, filmic tone curve, sRGB
  const GL_FS = 'precision highp float;varying vec3 vN;varying vec3 vO;varying vec3 vE;uniform float uDet;' +
    'float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}' +
    'float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);' +
    'return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}' +
    'float fbm(vec3 p){float s=0.0,a=0.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}' +
    'float vf(vec3 q){return vn(q)*0.62+vn(q*2.13+3.1)*0.38;}' +
    // a vessel = an iso-line of warped noise; its distance in mm (value / gradient) gives an even width; a second noise lets them start and end
    'float vessel(vec3 p,float f,float wmm,float sd){vec3 q=p*f+sd;q+=vec3(vn(q*0.5),vn(q*0.5+5.2),vn(q*0.5+9.7))*1.3;' +
    'float e=0.06,v=vf(q);vec3 g=(vec3(vf(q+vec3(e,0,0)),vf(q+vec3(0,e,0)),vf(q+vec3(0,0,e)))-v)/e;' +
    'float dist=abs(v-0.5)/max(length(g),0.08)/f;float m=smoothstep(0.32,0.6,vn(q*0.33+7.0));' +
    'return (1.0-smoothstep(wmm*0.45,wmm,dist))*m;}' +
    'float bn(vec3 p){return vn(p)*0.6+vn(p*2.3+4.0)*0.4;}' +
    'void main(){' +
    // photo-like, physical (Alex, 2026-11-16: "too much like an illustration", "contour lines inside that mean nothing", "soft, wet, living tissue"):
    // no iso-line vessels on the crowns any more (they read as map contours); vessels are meandering, broken, soft-edged and sit mostly in the sulci;
    // occlusion is broad and tinted with blood (not grey); a slow wobble in the normals; patchy wet glints; a faint milky arachnoid veil; colour mottling
    'float ao=smoothstep(0.0,1.0,vE.x),dep=vE.y,cu=vE.z*2.0-1.0;vec3 N=normalize(vN);' +
    'vec3 P=vO*0.22;float b0=bn(P),e=0.3;vec3 g=(vec3(bn(P+vec3(e,0,0)),bn(P+vec3(0,e,0)),bn(P+vec3(0,0,e)))-b0)/e;' +
    'vec3 g2=vec3(0.0);if(uDet>0.5){vec3 P2=vO*1.3;float c0=bn(P2);g2=(vec3(bn(P2+vec3(e,0,0)),bn(P2+vec3(0,e,0)),bn(P2+vec3(0,0,e)))-c0)/e;}' +   // fine bumps: high tier only
    'N=normalize(N-(0.16*(g-N*dot(g,N))+0.035*uDet*(g2-N*dot(g2,N))));' +
    'float t1=fbm(vO*0.3),t2=vn(vO*2.8),m1=fbm(vO*0.11+2.0),m2=fbm(vO*0.07+8.0),wet=smoothstep(0.42,0.68,fbm(vO*0.16+4.0));' +
    'float d=smoothstep(0.1,0.9,dep*0.5+(1.0-ao)*0.65-cu*0.1);' +
    'vec3 crown=vec3(0.50,0.33,0.28),sulc=vec3(0.22,0.07,0.06),grey=vec3(0.38,0.34,0.32);' +
    'vec3 alb=mix(crown,sulc,d);alb=mix(alb,grey,0.26*(1.0-d));' +
    'alb*=(0.9+0.16*t1+0.04*(t2-0.5)*uDet)*vec3(1.0+0.18*(m1-0.5),1.0+0.07*(m2-0.5)-0.06*(m1-0.5),1.0+0.1*(m2-0.5));' +
    'float wv=0.45+0.9*vn(vO*0.2+5.0);' +   // vessel width wanders along its length
    'float vm=0.0;if(uDet>0.5){vm=vessel(vO+vec3(vn(vO*0.09),vn(vO*0.09+3.0),0.0)*6.0,0.04,wv,0.0)*smoothstep(0.4,0.65,vn(vO*0.06+1.0))*(0.5+0.5*d);vm=smoothstep(0.0,0.45,vm);}' +   // vessels: high tier only
    'float vd=smoothstep(0.45,0.9,dep)*smoothstep(0.3,0.7,fbm(vO*0.09+6.0));' +   // blood in the depths of the sulci, in irregular patches
    'alb=mix(alb,vec3(0.17,0.025,0.045),clamp(vm*0.75+vd*0.45,0.0,0.8));' +
    'vec3 V=vec3(0,0,1),L=normalize(vec3(-0.42,0.55,0.72)),L2=normalize(vec3(0.65,-0.25,0.55));' +
    'float w=0.55,d1=max(0.0,(dot(N,L)+w)/(1.0+w)),d2=max(0.0,(dot(N,L2)+0.4)/1.4);' +
    'vec3 key=vec3(1.0,0.95,0.88)*1.4,fill=vec3(0.82,0.85,0.92)*0.3;' +
    'vec3 amb=mix(vec3(0.26,0.22,0.21),vec3(0.58,0.56,0.54),N.y*0.5+0.5)*0.5;' +
    'float occ=(0.1+0.9*pow(ao,1.7))*(1.0-0.5*smoothstep(0.5,1.0,dep));' +
    'vec3 sh=mix(vec3(0.5,0.17,0.14),vec3(1.0),occ);' +   // occlusion tinted with blood: sulci go deep red-brown, not grey
    'vec3 col=alb*sh*(key*d1*mix(1.0,occ,0.6)+fill*d2*occ+amb*occ);' +
    'col+=alb*vec3(0.9,0.22,0.16)*0.3*(1.0-d1*0.6)*(0.4+0.6*ao);' +   // light scattered under the surface, reddened
    'vec3 H=normalize(L+V);float nh=max(dot(N,H),0.0),nv=max(dot(N,V),0.0),F=0.04+0.96*pow(1.0-nv,5.0);' +
    'float sp=(pow(nh,60.0)*0.5*wet+pow(nh,14.0)*0.06+pow(nh,4.0)*0.02)*(0.5+0.5*F)*occ*(1.0-0.5*vm);' +   // wet glints in patches, a broad dim sheen
    'col+=key*sp;' +
    'col=mix(col,vec3(0.78,0.74,0.72)*0.55,0.10*pow(1.0-nv,2.0)*(0.6+0.4*t1));' +   // a faint milky veil (arachnoid), thicker at grazing angles
    'col=1.0-exp(-col*1.2);col=pow(col,vec3(1.0/2.2));' +
    'float lu=dot(col,vec3(0.3,0.59,0.11));col=mix(vec3(lu),col,0.94);col=col*0.94+0.02;' +
    'gl_FragColor=vec4(col,1.0);}';
  // the low tier's tissue shader: no noise at all (cheap to compile and to run): tinted occlusion, wrap light, a soft sheen
  const GL_FS_LITE = 'precision mediump float;varying vec3 vN;varying vec3 vO;varying vec3 vE;' +
    'void main(){float ao=smoothstep(0.0,1.0,vE.x),dep=vE.y;vec3 N=normalize(vN);' +
    'float d=smoothstep(0.1,0.9,dep*0.5+(1.0-ao)*0.65);vec3 alb=mix(mix(vec3(0.50,0.33,0.28),vec3(0.38,0.34,0.32),0.26*(1.0-d)),vec3(0.22,0.07,0.06),d);' +
    'float occ=(0.1+0.9*pow(ao,1.7))*(1.0-0.5*smoothstep(0.5,1.0,dep));vec3 sh=mix(vec3(0.5,0.17,0.14),vec3(1.0),occ);' +
    'vec3 L=normalize(vec3(-0.42,0.55,0.72));float d1=max(0.0,(dot(N,L)+0.55)/1.55);' +
    'vec3 col=alb*sh*(vec3(1.0,0.95,0.88)*1.4*d1*mix(1.0,occ,0.6)+mix(vec3(0.26,0.22,0.21),vec3(0.58,0.56,0.54),N.y*0.5+0.5)*0.5*occ)+alb*vec3(0.9,0.22,0.16)*0.3*(1.0-d1*0.6)*(0.4+0.6*ao);' +
    'col+=vec3(1.0,0.95,0.88)*pow(max(dot(N,normalize(L+vec3(0.0,0.0,1.0))),0.0),14.0)*0.08*occ;' +
    'col=1.0-exp(-col*1.2);col=pow(col,vec3(1.0/2.2));gl_FragColor=vec4(col,1.0);}';
  const GL_PV = 'attribute vec2 aQ;void main(){gl_Position=vec4(aQ,0.0,1.0);}';
  // glitch pass: horizontal slices shifted (some bands show the ASCII underneath), thin torn lines, RGB split, scanlines, grain, static bands
  const GL_PF = 'precision highp float;uniform sampler2D uT;uniform vec2 uRes;uniform float uDpr,uSeed,uShow,uShift,uSplit,uScan,uNoise,uBandH,uTear,uRoll,uStatic,uAlpha,uBlur,uGrain,uCa,uVig,uGA;uniform sampler2D uG;' +
    'float h1(float n){return fract(sin(n*0.1731+uSeed*7.13)*43758.5453);}' +
    'vec2 px;float br;' +
    // the photo itself, slightly out of focus: a small 5-tap blur (it also feathers the silhouette)
    'vec4 B(vec2 p){if(br<=0.0)return texture2D(uT,p*px);return texture2D(uT,p*px)*0.36+(texture2D(uT,(p+vec2(br,br))*px)+texture2D(uT,(p+vec2(-br,br))*px)+texture2D(uT,(p+vec2(br,-br))*px)+texture2D(uT,(p+vec2(-br,-br))*px))*0.16;}' +
    // the PPA glow of the ASCII brain (Alex, 2026-11-17): the same character cells (cols x rows texture, nearest sampling), over the photo, torn with it
    'vec4 S(vec2 p){vec4 ph=B(p),g=texture2D(uG,p*px);float ga=g.a*uGA;return ph*(1.0-ga)+vec4(g.rgb*ga,ga);}' +
    'void main(){vec2 fc=gl_FragCoord.xy;float y=(uRes.y-fc.y)/uDpr+uRoll;px=1.0/uRes;br=uBlur*uDpr;' +
    'float band=floor(y/uBandH),show=step(h1(band*12.99),uShow),stat=step(1.0-uStatic,h1(band*4.11+3.0))*(1.0-show);' +
    'float off=(h1(band*3.7+1.0)-0.5)*2.0*uShift*step(0.4,h1(band*5.3+2.0));' +
    'float ln=floor(y/2.0);off+=step(1.0-uTear,h1(ln*1.618+7.0))*(h1(ln*7.1+5.0)-0.5)*140.0;' +
    'float o=off*uDpr,s=(uSplit+uCa)*uDpr;' +
    'vec4 cr=S(fc+vec2(o+s,0.0)),cg=S(fc+vec2(o,0.0)),cb=S(fc+vec2(o-s,s*0.3));' +
    'float a=max(cr.a,max(cg.a,cb.a));vec3 c=vec3(cr.r,cg.g,cb.b);' +
    'float n=fract(sin(dot(fc,vec2(12.9898,78.233))+uSeed*43.0)*43758.5453);' +
    'vec2 q=(fc*px-0.5)*vec2(uRes.x/uRes.y,1.0);c*=1.0-uVig*smoothstep(0.12,0.62,length(q));' +   // light falls off towards the edges
    'c+=(n-0.5)*uGrain*a;' +   // sensor grain
    'c=mix(c,vec3(n)*a,uNoise);c*=1.0-uScan*step(0.62,fract((fc.y/uDpr)/3.0));' +
    'vec4 o4=vec4(c,a)*show+vec4(vec3(n),1.0)*cg.a*stat*0.55;gl_FragColor=o4*uAlpha;}';
  // ---- quality tiers (Alex, 2026-11-17): stronger machines get the fine model, weaker ones a lighter glitch; "off" only without WebGL or when extremely slow ----
  // high = fine fsaverage6 mesh (the only tier that downloads it), full shader, up to 2 device px; medium = ASCII mesh, simplified shader, half resolution;
  // low = ASCII mesh, minimal shader and effects, quarter resolution. Chosen without delaying the page: instant hints (renderer string, memory, cores,
  // Save-Data, screen size), the ASCII brain's own frame times, and an idle micro-benchmark before the first glitch; then adapted live (down at once when
  // frames run slow, up only after a few smooth glitches). Remembered in localStorage as the next visit's starting point (re-checked each visit).
  // ?tier=high|medium|low|off forces one (no adaptation, not stored). All thresholds: CFG.glitchTier.
  const TIERS = ['high', 'medium', 'low', 'off'];
  const tierOf = n => TIERS.indexOf(n);
  const glForced = (() => { try { const v = new URLSearchParams(location.search).get('tier'); return tierOf(v) >= 0 ? tierOf(v) : -1; } catch (e) { return -1; } })();
  const TS = { cap: 0, probe: -1, remembered: -1, hints: {}, source: '', fast: 0 };   // tier state: hint cap, probe result, stored tier, reasons
  const tierCfg = t => CFG.glitchTiers[TIERS[t]];
  function glHints(rn) {   // instant hints -> the best tier this machine may get (index); each reason noted
    const C = CFG.glitchTier, h = TS.hints = {}, nav = navigator; let cap = 0;
    const lim = (t, why) => { if (t > cap) cap = t; h[why] = TIERS[t]; };
    if (C.softwareRe.test(rn || '')) lim(2, 'software');
    const mem = nav.deviceMemory; if (mem && mem <= C.memLow) lim(2, 'memory'); else if (mem && mem <= C.memMedium) lim(1, 'memory');
    if (nav.hardwareConcurrency && nav.hardwareConcurrency <= C.coresMedium) lim(1, 'cores');
    if (glLite()) lim(1, 'saveData');
    if (Math.min(screen.width || 9999, screen.height || 9999) < C.smallScreenPx) lim(1, 'smallScreen');
    const fm = frames.length >= 20 ? frames.slice().sort((a, b) => a - b)[frames.length >> 1] : 0;   // the ASCII brain's median render time so far
    if (fm > C.asciiLowMs) lim(2, 'asciiFrames'); else if (fm > C.asciiMediumMs) lim(1, 'asciiFrames');
    TS.asciiMs = Math.round(fm * 10) / 10; TS.cap = cap; return cap;
  }
  function glRemembered() {   // { t, age } of the stored tier, or t -1 (none, unreadable)
    try { const v = JSON.parse(localStorage.getItem('glitchTier') || 'null'); if (v && tierOf(v.tier) >= 0 && v.at > 0) return { t: tierOf(v.tier), age: Date.now() - v.at }; } catch (e) {}
    return { t: -1, age: Infinity };
  }
  function glRemember(t) { if (glForced >= 0) return; try { localStorage.setItem('glitchTier', JSON.stringify({ tier: TIERS[t], at: Date.now() })); } catch (e) {} }   // with the time it was decided
  function glCtx() {   // context and canvas; the renderer string is one of the hints
    G = { ok: false };
    const cv = document.createElement('canvas'); cv.id = 'photo'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none';
    const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    let gl = null, v2 = false;
    if (glForced !== 3) try { gl = cv.getContext('webgl2', opt); v2 = !!gl; if (!gl) gl = cv.getContext('webgl', opt); } catch (e) {}
    if (!gl) { glStats.err = glForced === 3 ? 'tier off (forced)' : 'no webgl'; G.none = true; TS.source = glForced === 3 ? 'override' : 'no webgl'; glStats.tier = 'off'; return false; }
    const ri = gl.getExtension('WEBGL_debug_renderer_info'), rn = ri ? String(gl.getParameter(ri.UNMASKED_RENDERER_WEBGL)) : '';
    glStats.renderer = rn.slice(0, 80); glHints(rn);
    Object.assign(G, { cv, gl, v2, par: gl.getExtension('KHR_parallel_shader_compile'), prog: {}, w: 0, h: 0, fw: 0, fh: 0, tier: -1, mesh: null, key: new Float32Array(13), mat: new Float32Array(9), full: false });
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); glDrop(); });   // set up again before the next glitch
    return true;
  }
  function glCompile(names) {   // programs by name ('lite', 'full', 'post'), compiled and linked; with KHR_parallel_shader_compile the driver works in the background
    const gl = G.gl, src = { lite: [GL_VS, GL_FS_LITE, ['aP', 'aN', 'aE']], full: [GL_VS, GL_FS, ['aP', 'aN', 'aE']], post: [GL_PV, GL_PF, ['aQ']] };
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    for (const n of names) if (!G.prog[n]) { const [vs, fs, at] = src[n], p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); gl.attachShader(p, a); gl.attachShader(p, f); at.forEach((x, i) => gl.bindAttribLocation(p, i, x)); gl.linkProgram(p); G.prog[n] = { p, a, f, u: null }; }
  }
  const glCompiled = names => !G.par || names.every(n => G.gl.getProgramParameter(G.prog[n].p, G.par.COMPLETION_STATUS_KHR));
  function glLink(names) {   // uniforms looked up (blocks until compiled when the driver has no parallel compile)
    const gl = G.gl;
    for (const n of names) { const P = G.prog[n]; if (P.u) continue;
      if (!gl.getProgramParameter(P.p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(P.p) || gl.getShaderInfoLog(P.a) || gl.getShaderInfoLog(P.f));
      P.u = {}; const k = gl.getProgramParameter(P.p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < k; i++) { const nm = gl.getActiveUniform(P.p, i).name; P.u[nm] = gl.getUniformLocation(P.p, nm); } }
    if (!G.gtex) { G.gtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, G.gtex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));   // the PPA glow cells: nearest = whole blocks
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); }
    if (!G.quad) { G.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW); }
    if (!G.ok) { G.ok = true; lblBox.after(G.cv); glStats.inits++; }   // over the glyphs, the labels and the leaders (only brain pixels are painted: the real brain carries no markers)
  }
  const progsFor = t => ['post', tierCfg(t).shader];
  const tierReady = t => progsFor(t).every(n => G.prog[n] && G.prog[n].u) && (tierCfg(t).mesh !== 'fine' || !!glHdRaw);
  function glUpload(m) {
    const gl = G.gl;
    if (G.mesh) { gl.deleteBuffer(G.mesh.bv); gl.deleteBuffer(G.mesh.bi); }
    let n = 0; for (const p of m.parts) n += p.idx.length;
    const ib = new Uint16Array(n), parts = []; let o = 0; for (const p of m.parts) { ib.set(p.idx, o); parts.push({ off: o * 2, n: p.idx.length, vb: p.v0 * 16 }); o += p.idx.length; }
    const bv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bv); gl.bufferData(gl.ARRAY_BUFFER, m.vb, gl.STATIC_DRAW);
    const bi = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bi); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
    G.mesh = { bv, bi, parts, low: m.low }; glStats.hd = !m.low; G.key[0] = NaN;
  }
  function glMeshFor(t) {   // upload the mesh this tier wants (if it is not already there)
    const hd = tierCfg(t).mesh === 'fine' && !!glHdRaw;
    if (G.mesh && G.mesh.low === !hd) return;
    const m = hd ? glDecodeHd() : null; glUpload(m || glLow());
  }
  function glSetTier(t) { t = Math.max(0, Math.min(2, t)); G.tier = t; glStats.tier = TIERS[t]; G.pb = G.prog[tierCfg(t).shader]; G.pp = G.prog.post; glMeshFor(t); glSize(); }
  function glSize() {   // the overlay follows the glyph canvas (same css box; device pixels capped by the tier); the brain texture at the tier's scale
    const gl = G.gl, cv = G.cv, TC = tierCfg(Math.max(0, G.tier)), d = Math.min(dpr, G.full ? 2 : TC.dpr), w = Math.max(1, Math.round(cols * cw * d)), h = Math.max(1, Math.round(rows * ch * d));
    cv.style.top = canvas.style.top; cv.style.width = canvas.style.width; cv.style.height = canvas.style.height;
    if (w !== G.w || h !== G.h) { cv.width = w; cv.height = h; G.w = w; G.h = h; }
    const k = G.full ? 1 : TC.scale, ms = !G.full && TC.msaa, fw = Math.max(1, Math.round(w * k)), fh = Math.max(1, Math.round(h * k));
    glStats.scale = k;
    if (fw === G.fw && fh === G.fh && ms === G.ms) return;
    G.fw = fw; G.fh = fh; G.ms = ms; G.key[0] = NaN;
    for (const q of ['tex', 'fb', 'db', 'msfb', 'msc', 'msd']) if (G[q]) { const o = G[q]; if (q === 'tex') gl.deleteTexture(o); else if (q.endsWith('fb')) gl.deleteFramebuffer(o); else gl.deleteRenderbuffer(o); G[q] = null; }
    G.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    G.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, G.tex, 0);
    const samples = ms && G.v2 ? Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0) : 0;
    if (samples > 1) {   // WebGL2: multisampled brain (smooth silhouette), resolved into the texture
      G.msfb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, G.msfb);
      G.msc = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, G.msc); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, fw, fh); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, G.msc);
      G.msd = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, G.msd); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT16, fw, fh); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, G.msd);
    } else { G.db = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, G.db); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fw, fh); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, G.db); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function glBrain(R) {   // the real brain into the texture, from pose R (skipped when pose and layout are unchanged; no allocations per frame)
    const gl = G.gl, K = G.key; let same = K[9] === cols && K[10] === cw && K[11] === G.fw && K[12] === G.fh;
    for (let a = 0; a < 3 && same; a++) for (let c = 0; c < 3; c++) if (K[a * 3 + c] !== Math.fround(R[a][c])) { same = false; break; }
    if (same) return;
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { K[a * 3 + c] = R[a][c]; G.mat[c * 3 + a] = R[a][c]; }   // column-major for GLSL
    K[9] = cols; K[10] = cw; K[11] = G.fw; K[12] = G.fh;
    const s = cols * 0.96 / 182 * cw, Wc = cols * cw, Hc = rows * ch, Rm = M.radius * 1.1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.msfb || G.fb); gl.viewport(0, 0, G.fw, G.fh);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND);
    const P = G.pb, mm = G.mesh; gl.useProgram(P.p);
    gl.uniformMatrix3fv(P.u.uR, false, G.mat); gl.uniform3f(P.u.uK, s / (Wc / 2), s / (Hc / 2), 1 / Rm); gl.uniform1f(P.u.uHalf, M.half);
    if (P.u.uDet) gl.uniform1f(P.u.uDet, G.full ? 1 : tierCfg(G.tier).detail);
    gl.bindBuffer(gl.ARRAY_BUFFER, mm.bv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mm.bi);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    for (const p of mm.parts) {   // one draw per hemisphere (16-bit indices)
      gl.vertexAttribPointer(0, 3, gl.SHORT, true, 16, p.vb); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 16, p.vb + 8); gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 16, p.vb + 12);
      gl.drawElements(gl.TRIANGLES, p.n, gl.UNSIGNED_SHORT, p.off);
    }
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    if (G.msfb) { gl.bindFramebuffer(gl.READ_FRAMEBUFFER, G.msfb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, G.fb); gl.blitFramebuffer(0, 0, G.fw, G.fh, 0, 0, G.fw, G.fh, gl.COLOR_BUFFER_BIT, gl.NEAREST); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); glStats.brainDraws++;
  }
  function glTouch(t) {   // first use of a tier's programs (drivers finish compiling on first use): one hidden draw of each, waited for; returns ms of a second brain draw
    const gl = G.gl, px = new Uint8Array(4), R = lastRot || rotation(); glSetTier(t);
    const go = () => { G.key[0] = NaN; glBrain(R); gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); };
    go(); glPost(CLEAN); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const t0 = performance.now(); go(); return performance.now() - t0;
  }
  function glDecide() {   // after the micro-benchmark (the low tier's draw): the tier = the worst of hints, benchmark, and last visit's tier (it may climb back live)
    const C = CFG.glitchTier, ms = glStats.probeMs; TS.probe = ms <= C.probeMs[0] ? 0 : ms <= C.probeMs[1] ? 1 : ms <= C.probeMs[2] ? 2 : 3;
    if (glForced >= 0) { TS.source = 'override'; return glForced; }
    let t = Math.max(TS.cap, TS.probe); TS.source = t === TS.probe && TS.probe > TS.cap ? 'benchmark' : TS.cap > 0 ? 'hints' : 'benchmark';
    return t;
  }
  function glWarm() {   // gets everything ready in idle moments, one small step per idle callback; nothing is shown
    if (glWarming || (G && (G.ok || G.none)) || !M || document.hidden) return;
    glWarming = true; const idle = f => (window.requestIdleCallback || (g => setTimeout(g, 30)))(f, { timeout: 1500 }), T = glStats.setup = {};
    const mem = glRemembered(); TS.remembered = mem.t; TS.age = mem.age;
    if (glForced < 0 && mem.t >= 0 && mem.age < CFG.glitchTier.ttlMs) {   // decided less than a week ago: no new detection, straight to that tier's pieces
      TS.source = 'remembered'; if (mem.t === 3) { G = { ok: false, none: true }; glStats.tier = 'off'; glWarming = false; return; }   // (off: not even a context)
      idle(() => { if (!glWarming) return; const t0 = performance.now(); if (!glCtx()) { glWarming = false; return; } T.context = Math.round((performance.now() - t0) * 10) / 10; G.target = mem.t;
        glPrepare(mem.t, () => { glSetTier(mem.t); glWarming = false; }); });
      return;
    }
    const step = (name, f, next) => idle(() => { if (!glWarming || (name !== 'context' && !G)) return; const t0 = performance.now(); let r; try { r = f(); } catch (e) { glStats.err = String(e && e.message || e); glDrop(); glWarming = false; return; } T[name] = Math.round((performance.now() - t0) * 10) / 10; if (r === false) { glWarming = false; return; } next && next(); });
    const waitC = (names, next) => idle(() => { if (!glWarming || !G) return; if (glCompiled(names)) next(); else waitC(names, next); });
    step('context', glCtx, () => step('compile', () => glCompile(['lite', 'post']), () => waitC(['lite', 'post'], () => step('link', () => glLink(['lite', 'post']), () =>
      step('benchmark', () => { glStats.probeMs = Math.round(glTouch(2) * 10) / 10; const t = glDecide(); G.target = t; if (t === 3) { glStats.tier = 'off'; glRemember(3); G.none = true; const cv = G.cv; G.ok = false; cv.remove(); return false; } }, () => glPrepare(G.target, () => { glSetTier(G.target); glRemember(G.target); glWarming = false; }))))));
  }
  function glPrepare(t, done) {   // a better tier's pieces in idle steps (compile and first use of its shader; the fine mesh for high), then done()
    const idle = f => (window.requestIdleCallback || (g => setTimeout(g, 30)))(f, { timeout: 1500 }), T = glStats.setup || (glStats.setup = {}), names = progsFor(t);
    const timed = (name, f) => { const t0 = performance.now(); f(); T[name] = Math.round((performance.now() - t0) * 10) / 10; };
    const touch = () => idle(() => { if (!G || G.none) return; if (tierCfg(t).shader !== 'lite') timed('first use ' + TIERS[t], () => glTouch(t)); done(); });
    const fin = () => idle(() => { if (!G || G.none) return; if (tierCfg(t).mesh === 'fine' && glHdRaw) timed('mesh ' + TIERS[t], () => glUpload(glDecodeHd() || glLow())); touch(); });   // decode + upload, then (next idle moment) the first draw
    const mesh = () => tierCfg(t).mesh === 'fine' && !glHdRaw && !glLite() ? (glHdReq ? Promise.resolve() : glLoadHd()) : Promise.resolve();
    if (names.every(n => G.prog[n] && G.prog[n].u)) { mesh().then(fin); return; }
    idle(() => { if (!G || G.none) return; timed('compile ' + TIERS[t], () => glCompile(names));
      const w = () => idle(() => { if (!G || G.none) return; if (!glCompiled(names)) return w(); timed('link ' + TIERS[t], () => glLink(names)); mesh().then(fin); }); w(); });
  }
  function glReadyNow(want) {   // test / forced glitch without warm-up: everything at once (may stall)
    if (G && G.none) return false;
    if (!(G && G.ok)) { glWarming = false; if (G) glDrop();
      const mem = glRemembered(); TS.remembered = mem.t; TS.age = mem.age; const fresh = glForced < 0 && mem.t >= 0 && mem.age < CFG.glitchTier.ttlMs;
      if (fresh && mem.t === 3) { G = { ok: false, none: true }; glStats.tier = 'off'; TS.source = 'remembered'; return false; }   // (off: not even a context)
      try { if (!glCtx()) return false; if (fresh) { G.target = mem.t; TS.source = 'remembered'; } else { glCompile(['lite', 'post']); glLink(['lite', 'post']); glStats.probeMs = Math.round(glTouch(2) * 10) / 10; G.target = glDecide(); glRemember(G.target); } if (G.target === 3) { glStats.tier = 'off'; G.none = true; G.ok = false; G.cv.remove(); return false; } }
      catch (e) { glStats.err = String(e && e.message || e); glDrop(); return false; } }
    const t = want === undefined ? (G.target !== undefined ? G.target : 2) : want;
    try { glCompile(progsFor(t)); glLink(progsFor(t)); glSetTier(t); return true; } catch (e) { glStats.err = String(e && e.message || e); glDrop(); return false; }
  }
  function glDrop() { if (glA) glitchEnd(); if (G && G.cv) G.cv.remove(); G = null; glWarming = false; }
  function glFree() {   // tab hidden for a long time: give the GPU memory back
    if (!G || G.none) return; glStats.freed++; const lose = G.gl && G.gl.getExtension('WEBGL_lose_context'); const cv = G.cv; glDrop(); if (lose) try { lose.loseContext(); } catch (e) {} cv && cv.remove();
  }
  function glPost(q) {   // the glitch pass onto the visible canvas (q = look of this moment; clean = the photo as it is)
    const gl = G.gl, P = G.pp; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, G.w, G.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(P.u.uT, 0);
    gl.uniform2f(P.u.uRes, G.w, G.h); gl.uniform1f(P.u.uDpr, G.w / (cols * cw));
    gl.uniform1f(P.u.uSeed, q.Seed); gl.uniform1f(P.u.uShow, q.Show); gl.uniform1f(P.u.uShift, q.Shift); gl.uniform1f(P.u.uSplit, q.Split); gl.uniform1f(P.u.uScan, q.Scan); gl.uniform1f(P.u.uNoise, q.Noise);
    gl.uniform1f(P.u.uBandH, q.BandH); gl.uniform1f(P.u.uTear, q.Tear); gl.uniform1f(P.u.uRoll, q.Roll); gl.uniform1f(P.u.uStatic, q.Static); gl.uniform1f(P.u.uAlpha, q.Alpha);
    const ph = CFG.glitchPhoto, on = G.full || tierCfg(G.tier).photo ? 1 : 0; gl.uniform1f(P.u.uBlur, ph.blur * on); gl.uniform1f(P.u.uGrain, ph.grain * on); gl.uniform1f(P.u.uCa, ph.ca * on); gl.uniform1f(P.u.uVig, ph.vignette * on);   // the photo look (low tier: none)   // the photo look (every frame, clean or glitched)
    const ga = CFG.glitchPpa ? glowAlphaNow() : 0; gl.uniform1f(P.u.uGA, ga); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, G.gtex); gl.uniform1i(P.u.uG, 1);
    if (ga > 0) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glowLo); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }   // this frame's glow cells (tiny: cols x rows)
    gl.activeTexture(gl.TEXTURE0); glStats.ppaA = ga;
    gl.bindBuffer(gl.ARRAY_BUFFER, G.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  const CLEAN = { Seed: 0, Show: 1, Shift: 0, Split: 0, Scan: 0, Noise: 0, BandH: 1e4, Tear: 0, Roll: 0, Static: 0, Alpha: 1 };
  const LOOK = { Seed: 0, Show: 0, Shift: 0, Split: 0, Scan: 0, Noise: 0, BandH: 0, Tear: 0, Roll: 0, Static: 0, Alpha: 1 };   // reused (no allocation per frame)
  function glLook(kind, seed) {   // one burst's look, varied by seed (re-drawn every few frames: the tearing jumps)
    const r = k => { const x = Math.sin(seed * 91.7 + k * 13.1) * 43758.5453; return x - Math.floor(x); }, L = LOOK; L.Seed = seed;
    if (kind === 'tear') { L.Show = 0.4 + 0.3 * r(1); L.Shift = 16 + 36 * r(2); L.Split = 3 + 3 * r(3); L.Scan = 0.34; L.Noise = 0.12 + 0.1 * r(4); L.BandH = 9 + 32 * r(5); L.Tear = 0.03; L.Roll = 30 * r(6); L.Static = 0.25; }
    else { L.Show = r(1) < 0.5 ? 1 : 0.9; L.Shift = 6 * r(2); L.Split = 1 + 1.6 * r(3); L.Scan = 0.24; L.Noise = 0.06 + 0.05 * r(4); L.BandH = 24 + 70 * r(5); L.Tear = 0.015 * r(7); L.Roll = 40 * r(6); L.Static = 0.05; }
    return L;
  }
  function glDur() {   // two peaks: short (median glitchDurMedianMs) or, with chance glitchDurLongShare, long (median glitchDurLongMedianMs); lognormal each, clamped
    const z = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()), long = Math.random() < CFG.glitchDurLongShare;
    const d = long ? CFG.glitchDurLongMedianMs * Math.exp(CFG.glitchDurLongSigma * z) : CFG.glitchDurMedianMs * Math.exp(CFG.glitchDurSigma * z);
    return Math.max(CFG.glitchDurMinMs, Math.min(CFG.glitchDurMaxMs, d));
  }
  function glPlan() {   // bursts until the drawn length is filled: tear, then (gap, fuller look, tear) again and again; a long glitch gets more bursts and
    const D = glDur(), segs = []; let t = 0;   // longer clear frames (not the short sequence stretched)
    const add = (k, a, b) => { const d = rnd(a, b); segs.push({ k, d, t0: t, hop: k === 'tear' ? rnd(30, 50) : rnd(55, 90) }); t += d; };
    add('tear', 40, 80);
    while (t < D - 90) {
      add('off', 20, 70);
      const L = Math.max(0, Math.min(1, (D - t - 300) / 1200));   // room left beyond a short glitch's worth
      add('full', 70 + 250 * L, 140 + 450 * L);
      if (t < D - 60) add('tear', 30, 70);
    }
    return { segs, end: D };
  }
  function glitchStart(force, sync) {   // sync: set up at once if needed (test hook); the scheduler never stalls for it
    if (!M || (!force && glBlocked())) return false;
    if (!(G && G.ok)) {
      if (G && G.none) { glStats.skipped++; glSchedule(false); return false; }   // no WebGL here (or tier off): skipped silently
      if (!force && !sync) { glWarm(); glStats.deferred++; glNext = now() + 1000; return false; }   // not ready yet: a moment later, never stalling the page for it
      if (!glReadyNow()) { glStats.skipped++; glSchedule(false); return false; }   // (forced, e.g. the test hook) no WebGL: skipped silently
    }
    if (G.tier < 0) { if (!glReadyNow()) { glStats.skipped++; glSchedule(false); return false; } }
    glMeshFor(G.tier); glSize();
    const pl = glPlan(); glA = { t0: now(), segs: pl.segs, end: pl.end, seg: -1, shown: [], lastT: 0, slow: 0, maxDt: 0, n: 0 }; glStats.lastDur = Math.round(pl.end);
    G.cv.style.display = ''; glitchFrame(now()); return true;
  }
  function glitchFrame(t) {
    if (!G || !G.ok || !glA) return;
    if (glA.lastT) { const dt = t - glA.lastT; if (++glA.n > 1 && dt > glA.maxDt) glA.maxDt = dt;   // (the first interval includes the start)
      if (!glHold && glForced < 0 && dt > CFG.glitchTier.slowFrameMs && ++glA.slow >= 2 && G.tier < 2 && G.prog.lite && G.prog.lite.u) { glSetTier(G.tier + 1); glRemember(G.tier); glStats.tierDowns++; glA.slow = 0; TS.fast = 0; } }   // frames run slow: one tier lighter at once (kept)
    glA.lastT = t; glSize(); const R = rotation(); let q = null, kind = 'off';
    if (glHold) { kind = glHold.kind; q = kind === 'clean' ? CLEAN : glLook(kind, glHold.seed); }
    else {
      const u = t - glA.t0; if (u >= glA.end) { glitchEnd(); return; }
      let i = 0; while (i < glA.segs.length - 1 && u >= glA.segs[i].t0 + glA.segs[i].d) i++;
      const sg = glA.segs[i]; kind = sg.k;
      if (kind !== 'off') q = glLook(kind, Math.floor((u - sg.t0) / sg.hop) + 17 * i + glA.t0 % 97);
    }
    if (lastRot) for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const e = Math.abs(R[a][c] - lastRot[a][c]); if (e > glStats.poseErr) glStats.poseErr = e; }
    const gl = G.gl;
    if (!q) { if (glA.seg !== -2) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, G.w, G.h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); glA.seg = -2; } }   // a gap: cleared once
    else { glBrain(R); glPost(q); glA.seg = 0; }
    glStats.frames++; glStats.last = kind; glA.shown.push(kind);
  }
  function glitchEnd() {
    if (!glA) return;
    const A = glA; glA = null; glStats.glitches++;
    if (G && G.ok && !glHold && glForced < 0 && A.n >= 5) {   // smooth glitches, several in a row: one tier better, prepared in idle moments (never above the hints' cap)
      if (A.maxDt < CFG.glitchTier.fastFrameMs) TS.fast++; else TS.fast = 0;
      if (TS.fast >= CFG.glitchTier.upAfter && G.tier > Math.max(TS.cap, TS.probe < 3 ? Math.max(0, TS.probe - 1) : 2) && !glWarming) { const t = G.tier - 1; TS.fast = 0; glWarming = true; glPrepare(t, () => { glWarming = false; if (G && G.ok && !glA) { glSetTier(t); glRemember(t); glStats.tierUps = (glStats.tierUps || 0) + 1; } }); }
    }
    if (G && G.ok) { const gl = G.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); G.cv.style.display = 'none'; }
    if (glNext >= 0) glSchedule(false);
  }
  function glMask(lo) {   // test: the clean real-brain render read back and reduced to the ASCII cell grid (same sample points and >= 2 of 6 rule)
    if (!glReadyNow()) return null;
    const keepT = G.tier; G.full = true; glUpload(lo ? glLow() : (glDecodeHd() || glLow())); glSize(); G.key[0] = NaN; glBrain(lastRot || rotation());   // (the tier's shader; geometry is what is compared)
    const hd = glStats.hd, gl = G.gl, w = G.fw, h = G.fh, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fb); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const k = w / (cols * cw); let both = 0, any = 0, onlyA = 0, onlyP = 0;
    for (let yc = 0; yc < rows; yc++) for (let xc = 0; xc < cols; xc++) {
      let c = 0;
      for (let sy = 0; sy < SY; sy++) for (let sx = 0; sx < SX; sx++) { const X = Math.floor(((xc * SX + sx + 0.5) / SX) * cw * k), Y = Math.floor(((yc * SY + sy + 0.5) / SY) * ch * k); if (X < w && Y < h && px[((h - 1 - Y) * w + X) * 4 + 3] > 127) c++; }
      const p = c >= 2, a = cellD[yc * cols + xc] >= 0; if (p && a) both++; if (p || a) any++; if (a && !p) onlyA++; if (p && !a) onlyP++;
    }
    G.full = false; glSetTierForce(keepT);   // back to what the glitch uses here
    return { iou: any ? both / any : 0, both, onlyAscii: onlyA, onlyPhoto: onlyP, hd };
  }
  function glSetTierForce(t) { if (G.mesh) { G.gl.deleteBuffer(G.mesh.bv); G.gl.deleteBuffer(G.mesh.bi); G.mesh = null; } glCompile(progsFor(t)); glLink(progsFor(t)); glSetTier(t); }

  window.__brain = {
    nodNow: () => nod,
    spinNow: () => spinV,   // the idle spin's speed this frame (rad/ms; 0 when not spinning)
    setView(yDeg, pDeg) { cancelSwing(); yaw = yDeg * Math.PI / 180; pitch = pDeg * Math.PI / 180; vYaw = vPitch = 0; lastInteract = now(); render(); },
    getView() { return [yaw * 180 / Math.PI, pitch * 180 / Math.PI]; },
    hitTest: hit,
    anchorAt(id) { const l = LB.find(q => q.id === id); if (!l || !l.a) return null; const r = scene.getBoundingClientRect(), A = projP(rotation(), l.a[0], l.a[1], l.a[2]); return { x: r.left + A[0], y: r.top + A[1], facing: facing(rotation(), l.n) }; },
    ppaCellCount() { return ppaCount; },
    ppaDist,   // px from a client point to the nearest lit PPA cell's centre (null if none)
    ppaAlpha() { return ppaAlpha; },
    xrayAlpha() { return xrayA; },   // strongest x-ray glow alpha outside the direct blob, as last drawn
    glowStats() {   // glow field summary (alpha factors 0..1, multiply by the pulse alpha): top = mean of the 6 brightest cells (the blob's perceived brightness)
      const t = [0, 0, 0, 0, 0, 0]; let nd = 0, sum = 0;
      for (let i = 0; i < glowF.length; i++) { const f = glowF[i]; sum += f; if (cellPpa[i]) nd++; if (f > t[5]) { let j = 5; while (j > 0 && t[j - 1] < f) { t[j] = t[j - 1]; j--; } t[j] = f; } }
      return { dirMax, xrayMax, xrayCells: xrayN, directCells: nd, maxF: t[0], top: t.reduce((a, b) => a + b) / 6, sum, breathing: breathing() };
    },
    setGlow(v) { const r = setGlow(v); if (M) render(); return r; },   // internal comparison hook: 0 = stepped (the site's glow) .. 1 = the older smooth field; not stored
    glow() { return glowSoftness(); },
    glowBox(on) { if (on !== undefined) { gSubOff = !on; drawGlow(); } return gSub && !gSubOff; },   // test: stepped glow drawn as the lit cells' box (true) or as the whole image (false); same pixels
    setGlowSoft(on) { const r = setGlow(on ? 1 : 0); if (M) render(); return r === 1; },   // older alias of setGlow (internal)
    glowSoft() { return glowSoftness() >= 0.5; },
    glowField() { return { cols, rows, cw, ch, f: Array.from(glowF, v => Math.round(v * 1000) / 1000) }; },   // per-cell glow factors (row-major), for the anti-alias tests
    xrayCentre() { let bi = -1, bv = 0; for (let i = 0; i < glowF.length; i++) { const x = CFG.xrayK * cellX[i]; if (x >= glowF[i] && x > bv) { bv = x; bi = i; } } if (bi < 0) return null; const r = canvas.getBoundingClientRect(); return { x: r.left + (bi % cols + 0.5) * cw, y: r.top + (Math.floor(bi / cols) + 0.5) * ch }; },   // brightest x-ray-only cell (client px)
    pulsePhase(u) { pulseFix = u === null || u === undefined ? null : +u; drawGlow(); return ppaAlpha; },   // test: freeze the breath (0 = trough, 1 = peak), null = live
    pulsing() { return pulsing(); },
    ppaPointer() { const r = scene.getBoundingClientRect(), A = ppaPt(); return A ? { x: r.left + A[0], y: r.top + A[1], hemi: ppaH, weight: ppaW, gliding: ppaOff[0] !== 0 || ppaOff[1] !== 0 } : null; },
    ppaHemis() { const r = scene.getBoundingClientRect(); return ppaLast && ppaLast.map(q => ({ w: q.w, x: q.x === null ? null : r.left + q.x, y: q.y === null ? null : r.top + q.y })); },
    ppaBlobs() {   // connected groups (8-neighbour, 1-cell gaps bridged) of PPA cells: centre (client px) and size
      const r = canvas.getBoundingClientRect(), seen = new Uint8Array(cellPpa.length), out = [];
      for (let s = 0; s < cellPpa.length; s++) if (cellPpa[s] && !seen[s]) {
        const st = [s]; seen[s] = 1; let sx = 0, sy = 0, n = 0;
        while (st.length) { const i = st.pop(), x = i % cols, y = Math.floor(i / cols); sx += x; sy += y; n++;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy, j = yy * cols + xx; if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && cellPpa[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
        out.push({ x: r.left + (sx / n + 0.5) * cw, y: r.top + (sy / n + 0.5) * ch, n });
      }
      return out.sort((a, b) => b.n - a.n);
    },
    ppaCentre() { const bi = ppaCell(); if (bi < 0) return null; const r = canvas.getBoundingClientRect(); return { x: r.left + (bi % cols + 0.5) * cw, y: r.top + (Math.floor(bi / cols) + 0.5) * ch }; },
    labels() { const r = scene.getBoundingClientRect(); return LB.map(l => ({ id: l.id, x: r.left + l.box.x, y: r.top + l.box.y, w: l.box.w, h: l.box.h, alpha: l.box.alpha, open: l.open, oa: l.oa, hR: l.hR, hO: l.hO, aside: l.as })); },
    openLabel(id, hold) { const l = LB.find(q => q.id === id); if (l) openLbl(l, !!hold); },   // test hooks: open a box as a click would (hold: as while hovered), close it now
    closeLabel(id) { const l = LB.find(q => q.id === id); if (l) closeLbl(l); },
    amyNear() { return { side: amyH, glide: amyS }; },   // psychology dot: followed amygdala (0 left, 1 right) and glide position
    amyCells() {   // amygdala layer as last drawn: cells (client px of their centres), edge cells, cells on the PPA glow (must be 0), colour, layer calls so far
      const r = canvas.getBoundingClientRect(), at = ci => ({ x: r.left + (ci % cols + 0.5) * cw, y: r.top + (Math.floor(ci / cols) + 0.5) * ch, edge: amyG[ci] > 0, e: +amyE[ci].toFixed(3), a: +amyGA[ci].toFixed(3) });
      return { n: amyList.length, edge: amyList.filter(ci => amyG[ci]).length, onPpa: amyList.filter(ci => cellPpa[ci] || cellX[ci] >= 0.5).length, col: amyCol, calls: amyCalls, loaded: !!AMY, centres: AMY && AMY.map(q => q.c), cells: amyList.map(at) };
    },
    amyMs() { const s = amyMsA.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : -1; },   // median time (ms) of the amygdala layer over the last open frames
    setTone(g) { setTone(g); toneEl.value = tone; if (M) render(); },
    setDepth(t) { setDepth(snapT(t)); if (M) render(); },   // snaps to 3D (1) or contour (0)
    setDepthRaw(t) { setDepth(t); if (M) render(); },   // test-only: arbitrary in-between T for renderer checks
    tone() { return tone; },
    depth() { return T; },
    setDepthColor(on) { CFG.depthColor = !!on; dirty = true; if (M) render(); },
    depthColorOn() { return CFG.depthColor; },
    depthColor(which) {   // colour (css string) used for the nearest ('near') or farthest ('far') depth bin; with the switch off, the single ink colour
      if (!CFG.depthColor) return 'rgba(' + INK + ',1)';
      return 'rgb(' + RAMP[which === 'near' ? CFG.depthBins - 1 : 0] + ')';
    },
    depthTier() { return CFG.depthTier.slice(); },
    depthRampRgb() { return RAMP.map(c => c.slice()); },
    setPalette(nm) { setPalette(nm, false); if (M) render(); return window.palette(); },   // test hook (no persistence): moves the colour sliders to a preset; the swatches persist 'hueYB'/'hueGR'
    setHue(yb, gr) { setHue(yb, gr, false); if (M) render(); return window.hue(); },   // colour-opponent position: yb yellow -1 .. blue +1, gr green -1 .. red +1 (step 0.01); no persistence
    hue() { return window.hue(); },
    setBands(v) { setBands(v, false); if (M) render(); return CFG.depthBins; },   // 0 = soft (48 bins) .. 100 = stepped (8 bins); no persistence
    bands() { return { v: bands, bins: CFG.depthBins, hyst: hystB }; },
    palette() { return window.palette(); },
    fillStylesUsed() { return lastFills.slice(); },
    accentRgb() { return ACCENT; },
    mix() { return { d3: n3, ct: nC }; },
    brainRect() { const r = scene.getBoundingClientRect(); return rect ? { left: r.left + rect.x0, top: r.top + rect.y0, right: r.left + rect.x1, bottom: r.top + rect.y1 } : null; },
    found() { return found; },
    cellCount() { return drawn; },
    grid() { return { rows, cols, pad, bb: bb && Object.assign({}, bb), cw, ch, canvas: canvas.getBoundingClientRect().toJSON(), scene: scene.getBoundingClientRect().toJSON() }; },
    depthBinOf(z) { return Math.floor(depthPos(z)); },   // pure (no hysteresis) bin of a view-space depth value
    depthRange() { const R = M ? M.radius : 0; return { R, lo: CFG.depthLoR * R, hi: CFG.depthHiR * R }; },
    cfg: CFG,
    centring() { return !!ctr; },
    centreOn(id) { const l = LB.find(q => q.id === id); if (l) centreOn(l); },
    anchorView(id) { const l = LB.find(q => q.id === id), a = l && anchorOf(l); if (!a) return null; const R = rotation(), v = [0, 1, 2].map(i => R[i][0] * a[0] + R[i][1] * a[1] + R[i][2] * a[2]), n = Math.hypot(v[0], v[1], v[2]), P = projP(R, a[0], a[1], a[2]); return { angleDeg: Math.acos(v[2] / n) * 180 / Math.PI, px: P[0] / (cols * cw), py: P[1] / ((rows - 2 * pad) * ch), facing: l.n ? facing(R, l.n) : null }; },
    frameMs() { const s = frames.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : -1; },
    vertexCount() { return M ? M.nv : 0; },
    glitchNow(force) { return glitchStart(!!force, true); },   // a glitch now (false if blocked: drag, intro hand, hidden tab; force ignores that)
    glitchState() { return Object.assign({}, glStats, { active: !!glA, next: glNext ? glNext - now() : null, canvas: !!(G && G.cv && G.cv.isConnected), visible: !!(G && G.cv && G.cv.isConnected && G.cv.style.display !== 'none'), gl: !!(G && G.ok), v2: !!(G && G.v2), par: !!(G && G.par), warming: glWarming, hdLoaded: !!glHdRaw, flag: glFlag, kinds: glA ? glA.shown.slice() : null }); },
    glitchDurs(n) { return Array.from({ length: n }, glDur); },   // test: n glitch lengths drawn as a glitch draws them (ms)
    glitchGaps(n) { return Array.from({ length: n }, glGap); },   // test: n gaps drawn as the scheduler draws them (ms)
    glitchSchedule(ms) { glNext = ms === null || ms === undefined ? 0 : now() + ms; return glNext; },   // next scheduled glitch in ms (null: none); the scheduler still needs cfg.glitch
    glitchHold(kind, seed) { if (!kind) { glHold = null; glitchEnd(); return false; } glHold = { kind, seed: seed || 1 }; if (!glA) glitchStart(true); else glitchFrame(now()); return !!glA; },   // test / screenshots: hold 'clean' (the photo as is), 'full' or 'tear'
    glitchLoadHd() { return glHdRaw ? Promise.resolve(true) : glLoadHd(); },
    glitchMask(lo) { return glMask(!!lo); },
    glitchPixelAt(x, y) {   // test: the photo overlay's pixel at a client point, read right after drawing this frame (RGBA, premultiplied)
      if (!glA || !G || !G.ok) return null; G.key[0] = NaN; glitchFrame(now()); const r = G.cv.getBoundingClientRect(), X = Math.floor((x - r.left) / r.width * G.w), Y = G.h - 1 - Math.floor((y - r.top) / r.height * G.h), px = new Uint8Array(4);
      G.gl.readPixels(X, Y, 1, 1, G.gl.RGBA, G.gl.UNSIGNED_BYTE, px); return Array.from(px);
    },
    glitchBest() { if (!glReadyNow()) return false; glSetTierForce(0); return glStats.hd; },   // test / screenshots: the high tier's full look even on a slow (software) GL
    tier() { return { tier: G && G.ok && G.tier >= 0 ? TIERS[G.tier] : (G && G.none ? 'off' : null), cap: TIERS[TS.cap], benchmark: TS.probe >= 0 ? TIERS[TS.probe] : null, probeMs: glStats.probeMs, remembered: TS.remembered >= 0 ? TIERS[TS.remembered] : null, rememberedAgeH: TS.age < Infinity ? Math.round(TS.age / 36e5 * 10) / 10 : null, forced: glForced >= 0 ? TIERS[glForced] : null, source: TS.source, hints: Object.assign({}, TS.hints), asciiMs: TS.asciiMs, renderer: glStats.renderer || '', ready: !!(G && G.ok && G.tier >= 0), warming: glWarming }; },   // the glitch's quality tier and why
    setTier(n) { const t = tierOf(n); if (t < 0 || t > 2 || !glReadyNow(t)) return false; glSetTierForce(t); return TIERS[G.tier]; },   // test: switch now (prepared at once)
    glitchFree() { glFree(); return !G; },   // test: as after a long-hidden tab
    canvasFont() { return ctx.font; },
    ready: false
  };
  window.__brain.typing = () => typers.size;
  window.__brain.intro = () => ({ st: IN.st, step: IN.step, box: IN.box, kind: IN.kind, x: IN.x, y: IN.y, hinted: [...IN.hinted], disc: { ppa: ppaFound(), name: IN.nameFound }, todo: IN.st === 'skip' ? [] : todo(), opened: LB.filter(l => l.opened).map(l => l.id) });   // first-visit intro: st = off / wait / run / done / skip; step = the leg showing (ppa / name / settle / box / out); hinted = legs shown; todo = hints still to come; opened = boxes opened this visit
  layout();
  loadMesh().then(m => { M = m; snapAnchors(m); window.__brain.ready = true; dirty = true; if (!reduced && nmEl) { const s = typeInto(nmEl, 'Alex Zalen', { at: now() + 200 }); s.noCur = true; } if (!reduced) swT0 = now() + 600; requestAnimationFrame(tick); introArm(); if (CFG.glitch && !reduced) glSchedule(true);
    fetch('amygdala.json').then(r => r.json()).then(j => { AMY = [j.left, j.right].map(q => ({ v: Float32Array.from(q.v, (x, i) => x - m.cen[i % 3]), f: Uint16Array.from(q.f), c: q.c })); if (amyP.length < 2 * Math.max(j.left.n, j.right.n)) amyP = new Float32Array(2 * Math.max(j.left.n, j.right.n)); dirty = true; })
      .catch(err => { console.warn('amygdala outline not loaded', err); }); })   // after the first frame: only needed once the psychology box opens
    .catch(err => { console.error('mesh load failed', err); });
})();
