/*
 * The engine: one 960x540 scene. The top 400px is the world you photograph;
 * the bottom strip is "the public", who react to whatever you publish.
 * Chapters supply the world, the beats (events) and the endings.
 */
(function () {
  const JOM = window.JOM;
  const AUD = window.JOM_AUDIO;
  const W = 960, H = 540, SCENE_H = 400;
  const FRAME_MIN = 84, FRAME_MAX = 300, ASPECT = 2 / 3;
  const S = 2; // offscreen supersampling, so crops stay sharp
  const DISPLAY = { x: 18, y: 404, w: 196, h: 132 }; // where published stories end up

  /* What each kind of story does to the meters and the crowd. */
  const KIND = {
    theory:   { reach: +14, trust: -8,  belief: +0.30, mood: 'suspicious', bubble: '!?', sound: 'murmur',
                after: 'People are buzzing. Sales are up.' },
    truth:    { reach: -12, trust: +8,  belief: -0.22, mood: 'calm', bubble: 'oh.', sound: 'bad',
                after: 'Accurate, but some readers drifted to a paper with scarier headlines.' },
    reveal:   { reach: +6,  trust: +10, belief: -0.28, mood: 'happy', bubble: 'ah!', sound: 'good',
                after: 'People are talking about it. The real story had a twist.' },
    honest:   { reach: -6,  trust: +5,  belief: -0.08, mood: 'confused', bubble: '?', sound: 'murmur',
                after: 'Readers shrug. "So what really happened?"' },
    aifake:   { reach: +24, trust: -16, belief: +0.42, mood: 'shocked', bubble: '!!', sound: 'gasp',
                after: 'It is everywhere. Nobody asked where the picture came from.' },
    labelled: { reach: -4,  trust: +12, belief: -0.30, mood: 'calm', bubble: 'hm.', sound: 'good',
                after: 'Fewer shares, but the people who saw it trust you more.' },
    debunk:   { reach: +6,  trust: +12, belief: -0.30, mood: 'happy', bubble: 'ah!', sound: 'good',
                after: 'Your debunk spreads. Some people quietly delete their shares.' },
    ignored:  { reach: -8,  trust: 0,   belief: 0, mood: null, bubble: null, sound: null,
                after: 'The moment passes. Someone else will tell it their way.' },
  };
  const TRUTHY = ['truth', 'reveal', 'honest', 'labelled', 'debunk'];
  const THEORY = ['theory', 'aifake'];
  const PHONE_STATS = { theory: [12400, 3100], truth: [340, 41], reveal: [5200, 900], honest: [610, 70],
    aifake: [48200, 21700], labelled: [1900, 260], debunk: [8800, 2400] };

  const E = (JOM.engine = { W, H, SCENE_H, KIND, TRUTHY, THEORY });

  let els = {};
  let canvas, ctx, scene, sctx;
  let G = null;
  let hooks = {};
  let raf = 0, last = 0;
  let dragging = false;
  const staticCache = {};

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ======================= setup ======================= */
  E.init = function (h) {
    hooks = h || {};
    els = {
      stage: $('stage'), canvas: $('canvas'), hudYear: $('hudYear'), hudPlace: $('hudPlace'),
      reachLabel: $('reachLabel'), meterReach: $('meterReach'), meterTrust: $('meterTrust'),
      publishLayer: $('publishLayer'), yearCard: $('yearCard'), ycYear: $('ycYear'), ycPlace: $('ycPlace'), ycRole: $('ycRole'),
      composer: $('composer'), cmpImg: $('cmpImg'), cmpScan: $('cmpScan'), cmpCaption: $('cmpCaption'),
      cmpFindings: $('cmpFindings'), cmpActions: $('cmpActions'), cmpTitle: $('cmpTitle'),
      howto: $('howto'), pause: $('pause'), toast: $('toast'), ticker: $('ticker'), zoomFill: $('zoomFill'),
    };
    canvas = els.canvas;
    ctx = canvas.getContext('2d');
    scene = document.createElement('canvas');
    scene.width = W * S; scene.height = SCENE_H * S;
    sctx = scene.getContext('2d');

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (G) zoom(e.deltaY < 0 ? -16 : 16); }, { passive: false });
    window.addEventListener('keydown', onKey);
    els.stage.addEventListener('click', () => { if (G && G.skipPublish) G.skipPublish(); if (G && G.skipYear) G.skipYear(); });

    $('btnZoomIn').addEventListener('click', () => { AUD.unlock(); zoom(-36); });
    $('btnZoomOut').addEventListener('click', () => { AUD.unlock(); zoom(36); });
    $('btnShoot').addEventListener('click', () => { AUD.unlock(); capture(); });
    $('btnPause').addEventListener('click', () => E.pause());
    $('btnResume').addEventListener('click', () => E.resume());
    $('btnQuit').addEventListener('click', () => { E.stop(); hooks.onQuit && hooks.onQuit(); });
    $('btnHowPause').addEventListener('click', () => { els.pause.hidden = true; showHowto(() => { els.pause.hidden = false; }); });
    $('btnHowGo').addEventListener('click', () => { els.howto.hidden = true; const cb = els.howto._cb; els.howto._cb = null; cb && cb(); });

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(els.stage);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.running && !G.modal) E.pause(); });
  };

  function resize() {
    const r = els.stage.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
  }

  /* ======================= chapter lifecycle ======================= */
  E.start = function (chapter) {
    resize();
    G = {
      ch: chapter, running: true, modal: null,
      time: 0, beatIdx: -1, beat: null, beatT: 0, beatState: 'idle', afterT: 0,
      era: null, frame: { cx: 480, cy: 240, w: 170 },
      meters: { reach: chapter.start.reach, trust: chapter.start.trust },
      tallies: Object.fromEntries(Object.keys(KIND).map((k) => [k, 0])),
      flags: {}, log: [], actors: {}, display: null, folded: false,
      flash: 0, lastShot: -9, pings: [], crowd: makeCrowd(chapter),
    };
    E.G = G;
    els.publishLayer.innerHTML = '';
    setTicker('');
    updateZoom();
    updateMeters();
    cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    showHowto(() => startBeat(0));
  };

  E.stop = function () {
    if (!G) return;
    G.running = false;
    cancelAnimationFrame(raf);
    ['composer', 'howto', 'pause', 'yearCard'].forEach((k) => { els[k].hidden = true; });
    els.publishLayer.innerHTML = '';
  };

  E.pause = function () {
    if (!G || !G.running || G.modal === 'pause') return;
    G.prevModal = G.modal;
    G.modal = 'pause';
    syncMuteLabels();
    els.pause.hidden = false;
    $('btnResume').focus();
  };
  E.resume = function () {
    if (!G || G.modal !== 'pause') return;
    els.pause.hidden = true;
    G.modal = G.prevModal || null;
    G.prevModal = null;
  };

  function showHowto(cb) {
    if (G && G.modal !== 'pause') G.modal = 'howto';
    els.howto.hidden = false;
    els.howto._cb = () => { if (G) clearModal('howto'); cb && cb(); };
    $('btnHowGo').focus();
  }

  function era() { return G.ch.eras[G.era] || {}; }

  /* close a modal state, even if the game is paused on top of it */
  function clearModal(name) {
    if (G.modal === name) G.modal = null;
    if (G.prevModal === name) G.prevModal = null;
  }

  function startBeat(i) {
    if (!G.running) return;
    G.beatIdx = i;
    if (i >= G.ch.beats.length) { endChapter(); return; }
    const b = G.ch.beats[i];
    const eraChanged = b.era !== G.era;
    G.beat = b; G.beatT = 0; G.beatState = 'live'; G.pings = [];
    G.era = b.era;
    b.enter && b.enter(G);
    updateHud();
    if (eraChanged) {
      if (G.display && era().medium !== G.display.medium) G.display = null;
      showYearCard(b, () => setTicker(b.hint));
    } else {
      setTicker(b.hint);
    }
  }

  function showYearCard(b, done) {
    const e = era();
    els.ycYear.textContent = e.year;
    els.ycPlace.textContent = e.place;
    els.ycRole.textContent = e.role;
    els.yearCard.hidden = false;
    G.modal = 'year';
    AUD.whoosh();
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      els.yearCard.hidden = true;
      G.skipYear = null;
      clearModal('year');
      done && done();
    };
    G.skipYear = close;
    setTimeout(close, 3200);
  }

  function endChapter() {
    G.running = false;
    G.beatState = 'done';
    cancelAnimationFrame(raf);
    const endingId = G.folded ? 'folded' : G.ch.resolveEnding(G);
    hooks.onEnd && hooks.onEnd({
      chapter: G.ch, endingId, log: G.log, tallies: G.tallies, meters: G.meters, flags: G.flags,
      crowd: G.crowd.map((p) => p.b),
    });
  }

  /* ======================= input ======================= */
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }
  function moveFrame(x, y) {
    if (!G) return;
    const f = G.frame, h = f.w * ASPECT;
    f.cx = JOM.clamp(x, f.w / 2, W - f.w / 2);
    f.cy = JOM.clamp(y, h / 2, SCENE_H - h / 2);
  }
  function zoom(d) {
    if (!G) return;
    G.frame.w = JOM.clamp(G.frame.w + d, FRAME_MIN, FRAME_MAX);
    moveFrame(G.frame.cx, G.frame.cy);
    updateZoom();
  }
  function updateZoom() {
    if (!G) return;
    els.zoomFill.style.width = ((G.frame.w - FRAME_MIN) / (FRAME_MAX - FRAME_MIN)) * 100 + '%';
  }
  function onPointerMove(e) {
    if (!G) return;
    const p = toLogical(e);
    if (e.pointerType === 'mouse' || dragging) moveFrame(p.x, p.y);
  }
  function onPointerDown(e) {
    if (!G) return;
    AUD.unlock();
    const p = toLogical(e);
    if (G.modal) return; // clicks during overlays skip them (handled on the stage)
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      moveFrame(p.x, p.y);
      capture();
    } else {
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
      moveFrame(p.x, p.y);
    }
  }
  function onKey(e) {
    if (!G || !G.running) return;
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P') {
      if (G.modal === 'pause') E.resume(); else if (!G.modal || G.modal === 'publish') E.pause();
      e.preventDefault();
      return;
    }
    if (G.modal === 'publish' && (k === ' ' || k === 'Enter')) { G.skipPublish && G.skipPublish(); e.preventDefault(); return; }
    if (G.modal === 'year' && (k === ' ' || k === 'Enter')) { G.skipYear && G.skipYear(); e.preventDefault(); return; }
    if (G.modal) return;
    const step = e.shiftKey ? 36 : 14;
    const f = G.frame;
    switch (k) {
      case 'ArrowLeft': moveFrame(f.cx - step, f.cy); break;
      case 'ArrowRight': moveFrame(f.cx + step, f.cy); break;
      case 'ArrowUp': moveFrame(f.cx, f.cy - step); break;
      case 'ArrowDown': moveFrame(f.cx, f.cy + step); break;
      case '-': case '_': case '[': case 'q': case 'Q': zoom(-24); break;
      case '=': case '+': case ']': case 'e': case 'E': zoom(24); break;
      case ' ': case 'Enter': AUD.unlock(); capture(); break;
      default: return;
    }
    e.preventDefault();
  }

  /* ======================= capturing ======================= */
  function frameRect() {
    const f = G.frame, h = f.w * ASPECT;
    return { x: f.cx - f.w / 2, y: f.cy - h / 2, w: f.w, h };
  }
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function capture() {
    if (!G || !G.running || G.modal || G.beatState !== 'live') return;
    if (G.time - G.lastShot < 0.5) return;
    G.lastShot = G.time;
    AUD.shutter();
    G.flash = 1;
    const rect = frameRect();
    G.lastRect = rect;
    const spots = G.beat.hotspots ? G.beat.hotspots(G, G.beatT) : [];
    const tags = new Set(spots.filter((s) => inRect(s, rect)).map((s) => s.tag));
    const key = G.beat.classify(tags, G, rect);
    const photo = snap(rect);
    if (!key) {
      G.meters.reach = JOM.clamp(G.meters.reach - 2, 0, 100);
      updateMeters();
      toast(G.beat.missText || 'Nothing worth publishing in that shot.');
      return;
    }
    if (G.beat.composer) openComposer(key, photo);
    else publish(key, photo);
  }

  function snap(r) {
    const c = document.createElement('canvas');
    c.width = 360; c.height = 240;
    const x = c.getContext('2d');
    x.drawImage(scene, r.x * S, r.y * S, r.w * S, r.h * S, 0, 0, 360, 240);
    const f = era().photo;
    if (f === 'halftone') return halftone(c, 4);
    if (f === 'halftone-fine') return halftone(c, 3);
    return c;
  }

  function halftone(src, cell) {
    const w = src.width, h = src.height;
    const data = src.getContext('2d').getImageData(0, 0, w, h).data;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const o = out.getContext('2d');
    o.fillStyle = '#ece5d5'; o.fillRect(0, 0, w, h);
    o.fillStyle = '#1e1c19';
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        let sum = 0, n = 0;
        for (let yy = y; yy < Math.min(h, y + cell); yy++) {
          for (let xx = x; xx < Math.min(w, x + cell); xx++) {
            const i = (yy * w + xx) * 4;
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++;
          }
        }
        const L = Math.pow(sum / n / 255, 1.15);
        const rad = cell * 0.72 * Math.sqrt(1 - L);
        if (rad > 0.25) { o.beginPath(); o.arc(x + cell / 2, y + cell / 2, rad, 0, 7); o.fill(); }
      }
    }
    return out;
  }

  function thumb(c) {
    if (!c) return null;
    const t = document.createElement('canvas');
    t.width = 240; t.height = 160;
    t.getContext('2d').drawImage(c, 0, 0, 240, 160);
    return t.toDataURL('image/jpeg', 0.8);
  }

  /* ======================= publishing ======================= */
  function publish(key, photo, opts = {}) {
    const b = G.beat;
    const choice = b.choices[key];
    const kind = choice.kind;
    G.beatState = 'resolving';
    G.tallies[kind] = (G.tallies[kind] || 0) + 1;
    if (b.flag) G.flags[b.flag] = key;
    G.log.push({ beat: b, key, kind, headline: choice.headline, img: thumb(photo), label: opts.label || null, era: G.era });

    const afterText = typeof choice.after === 'function' ? choice.after(G) : choice.after;
    if (kind === 'ignored') {
      react(kind);
      setTicker(afterText || KIND.ignored.after);
      G.beatState = 'after'; G.afterT = 2.4;
      return;
    }
    const medium = era().medium;
    G.modal = 'publish';
    showPublished(medium, choice, photo, opts, () => {
      G.display = { photo, headline: choice.headline, kind, medium, label: opts.label || null };
      clearModal('publish');
      react(kind);
      setTicker(afterText || KIND[kind].after);
      G.beatState = 'after'; G.afterT = 2.6;
    });
  }

  function showPublished(medium, choice, photo, opts, done) {
    const layer = els.publishLayer;
    layer.innerHTML = '';
    const url = photo ? photo.toDataURL('image/jpeg', 0.88) : '';
    const e = era();
    const b = G.beat;
    const el = document.createElement('div');
    el.className = 'pub';
    if (medium === 'newspaper') {
      el.innerHTML = `<div class="paper"><div class="mast">${esc(e.masthead)}</div>
        <div class="dateline"><span>${esc(b.date)}</span><span>${esc(e.price || '')}</span></div>
        <h2 class="headline">${esc(choice.headline)}</h2>${url ? `<img src="${url}" alt="">` : ''}<div class="cols"></div></div>`;
      el.classList.add('spin-in');
      AUD.whoosh(); setTimeout(() => AUD.thud(), 800);
    } else if (medium === 'tv') {
      el.innerHTML = `<div class="tv"><div class="tv-screen">${url ? `<img src="${url}" alt="">` : ''}
        <div class="tv-lower"><small>${esc(e.channel || 'Evening News')}</small>${esc(choice.headline)}</div></div></div>`;
      el.classList.add('rise-in');
      AUD.tick();
    } else {
      const stats = PHONE_STATS[choice.kind] || [500, 50];
      el.innerHTML = `<div class="phone"><div class="post">
        <div class="post-head"><i class="post-avatar"></i><div><b>${esc(e.handle || 'You')}</b><span>${esc(e.at || '@you')} · now</span></div></div>
        <p class="post-text">${esc(choice.headline)}</p>
        ${opts.label ? `<div class="post-label">${esc(opts.label)}</div>` : ''}
        ${url ? `<img src="${url}" alt="">` : ''}
        <div class="post-stats"><span><b data-n="${stats[0]}">0</b> likes</span><span><b data-n="${stats[1]}">0</b> shares</span></div>
      </div></div>`;
      el.classList.add('rise-in');
      AUD.ping();
      const nums = el.querySelectorAll('[data-n]');
      const t0 = performance.now();
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / 2200);
        nums.forEach((n) => { n.textContent = Math.round(Number(n.dataset.n) * (1 - Math.pow(1 - k, 3))).toLocaleString(); });
        if (k < 1 && el.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    // fly towards the display stand in the bottom-left
    const tx = (DISPLAY.x + DISPLAY.w / 2) / 9.6 - 50;
    const ty = (DISPLAY.y + DISPLAY.h / 2) / 9.6 - 28.125;
    el.style.setProperty('--fx', tx + 'cqw');
    el.style.setProperty('--fy', ty + 'cqw');
    layer.appendChild(el);

    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      G.skipPublish = null;
      el.classList.remove('spin-in', 'rise-in');
      el.classList.add('fly-out');
      setTimeout(() => { el.remove(); done(); }, 650);
    };
    const minShow = setTimeout(() => { G.skipPublish = finish; }, 700);
    const auto = setTimeout(finish, medium === 'phone' ? 3600 : 3300);
    G.cancelPublish = () => { clearTimeout(minShow); clearTimeout(auto); };
  }

  function react(kind) {
    const k = KIND[kind];
    G.meters.reach = JOM.clamp(G.meters.reach + k.reach, 0, 100);
    G.meters.trust = JOM.clamp(G.meters.trust + k.trust, 0, 100);
    if (G.meters.reach <= 0) G.folded = true;
    updateMeters();
    if (k.sound && AUD[k.sound]) AUD[k.sound]();
    const rnd = JOM.rng((G.time * 1000) | 0);
    G.crowd.forEach((p, i) => {
      let d = k.belief * (0.65 + rnd() * 0.7);
      // confirmation bias: people who already lean one way are harder to move the other way
      if (d < 0 && p.b > 0.45) d *= 0.35;
      if (d > 0 && p.b < -0.45) d *= 0.5;
      p.b = JOM.clamp(p.b + d, -1, 1);
      if (k.mood) { p.moodT = 2.5 + rnd() * 1.5; p.tmpMood = k.mood; }
      if (k.bubble && rnd() < 0.35) p.bubble = { text: k.bubble, t: 2.2 + rnd() * 0.8, delay: i * 0.05 };
      p.look = -0.8;
    });
  }

  /* ======================= AI composer ======================= */
  function openComposer(baseKey, photo) {
    const b = G.beat, c = b.composer;
    G.modal = 'composer';
    G.composerBase = baseKey;
    els.composer.hidden = false;
    els.cmpImg.src = photo.toDataURL('image/jpeg', 0.9);
    els.cmpTitle.textContent = 'New post';
    els.cmpCaption.textContent = c.caption(baseKey, G);
    els.cmpFindings.hidden = true;
    els.cmpFindings.innerHTML = '';
    els.cmpScan.classList.remove('on');
    renderOptions(c.options(baseKey, G), photo);
  }

  function renderOptions(list, photo) {
    const box = els.cmpActions;
    box.innerHTML = '';
    list.forEach((o, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (o.style === 'ai' ? 'btn-ai' : o.style === 'check' ? 'btn-check' : o.style === 'primary' ? 'btn-primary' : '');
      btn.innerHTML = `<span>${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}</span>`;
      btn.addEventListener('click', () => onOption(o, photo));
      box.appendChild(btn);
      if (i === 0) setTimeout(() => btn.focus(), 30);
    });
  }

  function closeComposer() {
    els.composer.hidden = true;
    els.cmpScan.classList.remove('on');
    clearModal('composer');
  }

  function onOption(o, photo) {
    const b = G.beat, c = b.composer;
    if (o.act === 'post') { closeComposer(); publish(o.key, photo, { label: o.postLabel }); return; }
    if (o.act === 'skip') { closeComposer(); publish('ignored', null); return; }
    if (o.act === 'ai') {
      els.cmpActions.innerHTML = '';
      els.cmpCaption.textContent = 'Enhancing…';
      els.cmpScan.classList.add('on');
      AUD.sparkle();
      const out = c.enhance ? c.enhance(photo, G) : photo;
      setTimeout(() => {
        els.cmpScan.classList.remove('on');
        els.cmpImg.src = out.toDataURL('image/jpeg', 0.9);
        els.cmpCaption.textContent = b.choices[o.key].headline;
        renderOptions([{ label: 'Post it', style: 'ai', act: 'post', key: o.key }], out);
      }, 1100);
      return;
    }
    if (o.act === 'check') {
      els.cmpActions.innerHTML = '';
      els.cmpTitle.textContent = 'TruthLens check';
      els.cmpScan.classList.add('on');
      els.cmpFindings.hidden = false;
      els.cmpFindings.innerHTML = '<p class="tl-head">Checking…</p>';
      AUD.scan();
      const finds = c.findings;
      finds.forEach((f, i) => {
        setTimeout(() => {
          const p = document.createElement('p');
          p.textContent = f;
          els.cmpFindings.appendChild(p);
          AUD.tick();
          if (i === finds.length - 1) {
            els.cmpScan.classList.remove('on');
            els.cmpFindings.querySelector('.tl-head').textContent = 'TruthLens found:';
            renderOptions(c.afterCheck(G), photo);
          }
        }, 700 + i * 900);
      });
      return;
    }
    if (o.act === 'back') {
      els.cmpTitle.textContent = 'New post';
      els.cmpFindings.hidden = true;
      renderOptions(c.options(G.composerBase, G), photo);
    }
  }

  /* ======================= crowd ======================= */
  function makeCrowd(ch) {
    const rnd = JOM.rng(11);
    const n = 16;
    const list = [];
    for (let i = 0; i < n; i++) {
      const row = i % 2;
      list.push({
        home: 250 + (i + 0.5) * (690 / n) + (rnd() - 0.5) * 14,
        x: 0, y: row ? 528 : 488, r: 13 + rnd() * 3.5,
        b: (rnd() - 0.5) * 0.35, seed: rnd() * 10, tone: Math.floor(rnd() * 4), hatRoll: rnd(),
        moodT: 0, tmpMood: null, bubble: null, look: -0.6, phase: rnd() * 6.28,
      });
    }
    list.forEach((p) => { p.x = p.home; });
    if (ch.crowdStart) ch.crowdStart(list);
    return list;
  }

  function updateCrowd(dt) {
    const c = G.crowd;
    for (const p of c) {
      // group pressure: drift toward the people standing next to you
      let sum = 0, n = 0;
      for (const q of c) if (q !== p && Math.abs(q.home - p.home) < 95) { sum += q.b; n++; }
      if (n) p.b += (sum / n - p.b) * 0.05 * dt;
      p.x = p.home + Math.sin(G.time * 0.4 + p.phase) * 6;
      if (p.moodT > 0) p.moodT -= dt;
      if (p.bubble) {
        if (p.bubble.delay > 0) p.bubble.delay -= dt; else { p.bubble.t -= dt; if (p.bubble.t <= 0) p.bubble = null; }
      }
      p.look = JOM.lerp(p.look, Math.sin(G.time * 0.3 + p.phase) * 0.6 - 0.2, dt * 0.5);
    }
  }

  function crowdColor(p, base) {
    if (p.b > 0) return JOM.mix(base, '#e4583f', Math.min(1, p.b * 1.1));
    return JOM.mix(base, '#4fb0ad', Math.min(1, -p.b * 1.1));
  }

  function drawStrip(c) {
    const e = era();
    const pal = e.strip || {};
    c.fillStyle = pal.wall || '#3a3631';
    c.fillRect(0, SCENE_H, W, 46);
    c.fillStyle = pal.ground || '#5b5650';
    c.fillRect(0, SCENE_H + 46, W, H - SCENE_H - 46);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < W; x += 48) c.fillRect(x, SCENE_H + 46, 1, H - SCENE_H - 46);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(0, SCENE_H, W, 3);
    c.fillStyle = pal.label || 'rgba(255,255,255,0.55)';
    c.font = '700 10px "Space Mono", monospace';
    c.textAlign = 'right'; c.textBaseline = 'top';
    c.fillText('THE PUBLIC', W - 12, SCENE_H + 8);
  }

  function drawCrowd(c) {
    const e = era();
    const tones = e.crowdTones || ['#d8cdb6', '#c9bda3', '#ddd3bf', '#bfb39c'];
    const sorted = [...G.crowd].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      const base = tones[p.tone % tones.length];
      const mood = p.moodT > 0 ? p.tmpMood : p.b > 0.55 ? 'suspicious' : p.b < -0.55 ? 'happy' : 'calm';
      const style = e.crowdStyle ? e.crowdStyle(p) : {};
      JOM.peep(c, {
        x: p.x, y: p.y, r: p.r, color: crowdColor(p, base), mood, look: p.look, t: G.time, seed: p.seed,
        shake: p.moodT > 0 && (p.tmpMood === 'shocked' || p.tmpMood === 'angry'), dir: -1, ...style,
      });
      if (p.bubble && p.bubble.delay <= 0) {
        const a = Math.min(1, p.bubble.t * 2);
        JOM.bubble(c, p.x, p.y - p.r * 2.7 - 6, p.bubble.text, { size: 10, bold: true, alpha: a, maxW: 60,
          fg: p.bubble.text.includes('!') ? '#b2311e' : '#1d1b18' });
      }
    }
  }

  function drawDisplay(c) {
    const e = era();
    const d = G.display;
    const { x, y, w, h } = DISPLAY;
    const m = e.medium;
    c.save();
    if (m === 'newspaper') {
      c.fillStyle = '#5a3f2a'; c.fillRect(x + 8, y + 70, w - 16, h - 70);
      c.fillStyle = '#6e5038'; c.fillRect(x + 4, y + 66, w - 8, 10);
      c.fillStyle = '#e8c35a'; c.font = '700 10px "Space Mono", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('NEWS', x + w / 2, y + 104);
      c.fillStyle = '#ece5d5'; c.fillRect(x + 22, y + 2, w - 44, 100);
      c.fillStyle = '#1d1b18';
      c.font = '700 9px "Old Standard TT", Georgia, serif';
      c.fillText(e.masthead || 'THE COURIER', x + w / 2, y + 10);
      c.fillRect(x + 28, y + 16, w - 56, 1);
      if (d) {
        c.font = '700 8.5px "Old Standard TT", Georgia, serif';
        const lines = JOM.wrap(c, d.headline.toUpperCase(), w - 60).slice(0, 2);
        lines.forEach((l, i) => c.fillText(l, x + w / 2, y + 24 + i * 9));
        if (d.photo) c.drawImage(d.photo, x + 34, y + 24 + lines.length * 9, w - 68, (w - 68) * ASPECT);
      } else {
        c.font = '700 14px "Old Standard TT", Georgia, serif';
        c.fillText('EXTRA', x + w / 2, y + 50);
      }
    } else if (m === 'tv') {
      c.fillStyle = '#3b3027'; c.fillRect(x + 30, y + 112, 10, 20); c.fillRect(x + w - 40, y + 112, 10, 20);
      c.fillStyle = '#5b4632'; JOM.roundRect(c, x + 6, y + 4, w - 12, 110, 10); c.fill();
      c.fillStyle = '#111'; JOM.roundRect(c, x + 16, y + 12, w - 60, 94, 12); c.fill();
      c.fillStyle = '#2e2620'; c.beginPath(); c.arc(x + w - 26, y + 36, 7, 0, 7); c.arc(x + w - 26, y + 62, 7, 0, 7); c.fill();
      if (d && d.photo) {
        c.save(); JOM.roundRect(c, x + 16, y + 12, w - 60, 94, 12); c.clip();
        c.filter = 'sepia(0.35) saturate(0.8)';
        c.drawImage(d.photo, x + 16, y + 12, w - 60, 94);
        c.filter = 'none';
        c.fillStyle = 'rgba(16,30,70,0.85)'; c.fillRect(x + 16, y + 84, w - 60, 18);
        c.fillStyle = '#fff'; c.font = '700 7px "Space Mono", monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(JOM.wrap(c, d.headline.toUpperCase(), w - 70)[0], x + 20, y + 93);
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let yy = y + 12; yy < y + 106; yy += 3) c.fillRect(x + 16, yy, w - 60, 1);
    } else {
      c.fillStyle = '#0f1013'; JOM.roundRect(c, x + 40, y + 2, w - 80, h - 4, 12); c.fill();
      c.fillStyle = '#1b1d22'; JOM.roundRect(c, x + 46, y + 10, w - 92, h - 20, 6); c.fill();
      if (d) {
        c.fillStyle = '#7a6cff'; c.beginPath(); c.arc(x + 56, y + 20, 5, 0, 7); c.fill();
        c.fillStyle = '#f4f4f6'; c.font = '700 7px system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top';
        const lines = JOM.wrap(c, d.headline, w - 104).slice(0, 2);
        lines.forEach((l, i) => c.fillText(l, x + 64, y + 15 + i * 9));
        if (d.photo) c.drawImage(d.photo, x + 50, y + 38, w - 100, (w - 100) * ASPECT);
        if (d.label) { c.fillStyle = 'rgba(79,176,173,0.85)'; c.fillRect(x + 50, y + 38 + (w - 100) * ASPECT - 10, w - 100, 10); c.fillStyle = '#082220'; c.font = '700 6px system-ui, sans-serif'; c.fillText('CONTEXT ADDED', x + 54, y + 38 + (w - 100) * ASPECT - 8); }
      } else {
        c.fillStyle = '#9a9ca5'; c.font = '700 9px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('your feed', x + w / 2, y + h / 2);
      }
    }
    c.restore();
  }

  /* ======================= HUD ======================= */
  function updateHud() {
    const e = era();
    els.hudYear.textContent = e.year;
    els.hudPlace.textContent = e.place;
    els.reachLabel.textContent = e.reachLabel || 'Readers';
  }
  function updateMeters() {
    const m = G.meters;
    els.meterReach.querySelector('i').style.width = m.reach + '%';
    els.meterTrust.querySelector('i').style.width = m.trust + '%';
    els.meterReach.classList.toggle('low', m.reach < 22);
  }
  let tickerTimer = 0;
  function setTicker(text) {
    clearInterval(tickerTimer);
    const el = els.ticker;
    if (!text) { el.textContent = ''; return; }
    let i = 0;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { el.textContent = text; return; }
    el.innerHTML = '<span></span><i class="cursor"></i>';
    const span = el.firstChild;
    tickerTimer = setInterval(() => {
      i += 2;
      span.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(tickerTimer);
    }, 22);
  }
  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1600);
  }
  E.toast = toast;
  E.setTicker = (t) => setTicker(t);

  function syncMuteLabels() {
    const m = AUD.isMuted();
    ['btnMutePause', 'btnMuteMenu'].forEach((id) => {
      const b = $(id); if (!b) return;
      b.textContent = 'Sound: ' + (m ? 'off' : 'on');
      b.setAttribute('aria-pressed', String(m));
    });
  }
  E.syncMuteLabels = syncMuteLabels;

  /* ======================= main loop ======================= */
  function loop(now) {
    if (!G || !G.running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (G.modal === 'pause') return;
    G.time += dt;
    const b = G.beat;
    const flowing = !G.modal || G.modal === 'publish';
    if (b && flowing) {
      G.beatT += dt;
      b.update && b.update(G, dt, G.beatT);
      if (G.beatState === 'live') {
        if (b.ping && (G.beatT > 1 && G.beatT - (G.lastPing || -99) > 6.5)) { G.pings.push({ x: b.ping[0], y: b.ping[1], t: 0 }); G.lastPing = G.beatT; }
        if (G.beatT > b.duration) publish('ignored', null);
      } else if (G.beatState === 'after' && !G.modal) {
        G.afterT -= dt;
        if (G.afterT <= 0) {
          G.lastPing = -99;
          if (G.folded) endChapter(); else startBeat(G.beatIdx + 1);
        }
      }
    }
    G.pings.forEach((p) => { p.t += dt; });
    G.pings = G.pings.filter((p) => p.t < 1.4);
    updateCrowd(dt);
    G.flash = Math.max(0, G.flash - dt * 3.5);
  }

  function render() {
    const ch = G.ch;
    // 1. the world, drawn offscreen so captures can crop it
    sctx.setTransform(S, 0, 0, S, 0, 0);
    if (ch.drawStatic) {
      let cached = staticCache[ch.id + G.era];
      if (!cached) {
        cached = document.createElement('canvas');
        cached.width = W * S; cached.height = SCENE_H * S;
        const cc = cached.getContext('2d');
        cc.setTransform(S, 0, 0, S, 0, 0);
        ch.drawStatic(cc, G.era);
        staticCache[ch.id + G.era] = cached;
      }
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.drawImage(cached, 0, 0);
      sctx.setTransform(S, 0, 0, S, 0, 0);
    }
    ch.drawDynamic && ch.drawDynamic(sctx, G);
    if (G.beat && G.beat.draw) G.beat.draw(sctx, G, G.beatT);

    // 2. the screen
    const sx = canvas.width / W, sy = canvas.height / H;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scene, 0, 0, scene.width, scene.height, 0, 0, canvas.width, SCENE_H * sy);
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    drawStrip(ctx);
    drawDisplay(ctx);
    drawCrowd(ctx);
    drawPings(ctx);
    if (G.beatState === 'live' && !G.modal) drawFrame(ctx);
    if (G.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.55})`;
      ctx.fillRect(0, 0, W, SCENE_H);
    }
  }

  function drawPings(c) {
    for (const p of G.pings) {
      const k = p.t / 1.4;
      c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - k)})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y, 8 + k * 46, 0, 7); c.stroke();
    }
  }

  function drawFrame(c) {
    const r = frameRect();
    c.save();
    c.fillStyle = 'rgba(10,10,10,0.26)';
    c.beginPath();
    c.rect(0, 0, W, SCENE_H);
    c.rect(r.x + r.w, r.y, -r.w, r.h);
    c.fill('evenodd');
    const L = Math.min(16, r.w * 0.18);
    c.lineWidth = 2.4; c.lineCap = 'square';
    for (const [col, off] of [['rgba(0,0,0,0.5)', 1.2], ['#ffffff', 0]]) {
      c.strokeStyle = col;
      c.beginPath();
      const x0 = r.x + off, y0 = r.y + off, x1 = r.x + r.w + off, y1 = r.y + r.h + off;
      c.moveTo(x0, y0 + L); c.lineTo(x0, y0); c.lineTo(x0 + L, y0);
      c.moveTo(x1 - L, y0); c.lineTo(x1, y0); c.lineTo(x1, y0 + L);
      c.moveTo(x0, y1 - L); c.lineTo(x0, y1); c.lineTo(x0 + L, y1);
      c.moveTo(x1 - L, y1); c.lineTo(x1, y1); c.lineTo(x1, y1 - L);
      c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    c.beginPath(); c.moveTo(cx - 5, cy); c.lineTo(cx + 5, cy); c.moveTo(cx, cy - 5); c.lineTo(cx, cy + 5); c.stroke();
    // little "REC" style label tells you the medium
    c.fillStyle = '#ffffff'; c.font = '700 9px "Space Mono", monospace'; c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText(era().frameLabel || 'PHOTO', r.x + 2, r.y - 3);
    c.restore();
  }

  /* ---------- test hooks (used by the automated play-through) ---------- */
  E.debug = {
    state: () => G,
    aim: (x, y, w) => { if (w) { G.frame.w = JOM.clamp(w, FRAME_MIN, FRAME_MAX); } moveFrame(x, y); updateZoom(); },
    shoot: () => capture(),
    skip: () => { if (G.skipYear) G.skipYear(); if (G.skipPublish) G.skipPublish(); },
    hotspots: () => (G.beat && G.beat.hotspots ? G.beat.hotspots(G, G.beatT) : []),
  };
})();
