/* Drawing helpers: colours, "peeps" (the little people), props, speech bubbles. */
(function () {
  const JOM = (window.JOM = window.JOM || {});

  /* ---------- colour ---------- */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex([r, g, b]) {
    return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  JOM.mix = (a, b, t) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  };
  JOM.shade = (hex, amt) => (amt < 0 ? JOM.mix(hex, '#000000', -amt) : JOM.mix(hex, '#ffffff', amt));
  JOM.rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

  /* ---------- maths ---------- */
  JOM.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  JOM.lerp = (a, b, t) => a + (b - a) * t;
  JOM.ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
  JOM.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /* position after travelling distance d along a polyline */
  JOM.along = function (pts, d) {
    let rest = Math.max(0, d);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (rest <= len) {
        const t = len ? rest / len : 0;
        return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, dir: Math.sign(x2 - x1) || 1, done: false };
      }
      rest -= len;
    }
    const [lx, ly] = pts[pts.length - 1];
    return { x: lx, y: ly, dir: 1, done: true };
  };

  /* ---------- text ---------- */
  JOM.wrap = function (ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  JOM.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  /* speech bubble whose tail points at (x, y). Returns its box. */
  JOM.bubble = function (ctx, x, y, text, o = {}) {
    const size = o.size || 10;
    const maxW = o.maxW || 150;
    ctx.save();
    ctx.font = `${o.bold ? 700 : 400} ${size}px ${o.font || '"Space Mono", monospace'}`;
    const lines = JOM.wrap(ctx, text, maxW);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.2;
    const h = lines.length * size * 1.25 + size * 0.8;
    const bx = JOM.clamp(x - w / 2 + (o.dx || 0), 4, 956 - w);
    const by = y - h - (o.tail || 8);
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = o.bg || '#fffdf6';
    ctx.strokeStyle = o.stroke || '#1d1b18';
    ctx.lineWidth = 1.2;
    JOM.roundRect(ctx, bx, by, w, h, 5);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, by + h - 0.5); ctx.lineTo(x, y); ctx.lineTo(x + 4, by + h - 0.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = o.fg || '#1d1b18';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + size * 0.6, by + size * 0.45 + i * size * 1.25));
    ctx.restore();
    return { x: bx, y: by, w, h };
  };

  /* ---------- peeps ---------- */
  function eyes(ctx, ex, ey, r, mood, look, blink) {
    const er = Math.max(1.1, r * 0.11);
    const gap = r * 0.3;
    const ink = '#1d1b18';
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, r * 0.09);
    const L = ex - gap, R = ex + gap;
    if (blink) {
      ctx.beginPath(); ctx.moveTo(L - er, ey); ctx.lineTo(L + er, ey); ctx.moveTo(R - er, ey); ctx.lineTo(R + er, ey); ctx.stroke();
      return;
    }
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(L, ey + er * 0.6, er * 1.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.moveTo(R + er * 1.2 * Math.cos(Math.PI * 1.15), ey + er * 0.6 + er * 1.2 * Math.sin(Math.PI * 1.15));
      ctx.arc(R, ey + er * 0.6, er * 1.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      return;
    }
    if (mood === 'shocked') {
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath(); ctx.arc(L, ey, er * 1.9, 0, 7); ctx.arc(R, ey, er * 1.9, 0, 7); ctx.fill();
      ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(L + look * er * 0.6, ey, er * 0.8, 0, 7); ctx.arc(R + look * er * 0.6, ey, er * 0.8, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex, ey + r * 0.42, r * 0.1, r * 0.13, 0, 0, 7); ctx.fill();
      return;
    }
    if (mood === 'suspicious') {
      ctx.beginPath(); ctx.ellipse(L + look * 1, ey + er * 0.3, er * 1.15, er * 0.6, 0, 0, 7); ctx.ellipse(R + look * 1, ey + er * 0.3, er * 1.15, er * 0.6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(L - er * 1.6, ey - er * 1.1); ctx.lineTo(L + er * 1.4, ey - er * 0.6); ctx.moveTo(R - er * 1.4, ey - er * 0.6); ctx.lineTo(R + er * 1.6, ey - er * 1.1); ctx.stroke();
      return;
    }
    ctx.beginPath(); ctx.arc(L + look * er * 0.5, ey, er, 0, 7); ctx.arc(R + look * er * 0.5, ey, er, 0, 7); ctx.fill();
    if (mood === 'angry') {
      ctx.beginPath(); ctx.moveTo(L - er * 1.6, ey - er * 2.1); ctx.lineTo(L + er * 1.2, ey - er * 1.0); ctx.moveTo(R - er * 1.2, ey - er * 1.0); ctx.lineTo(R + er * 1.6, ey - er * 2.1); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey + r * 0.6, r * 0.18, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
    } else if (mood === 'confused') {
      ctx.beginPath(); ctx.moveTo(R - er * 1.2, ey - er * 2.4); ctx.quadraticCurveTo(R, ey - er * 3.2, R + er * 1.4, ey - er * 2.2); ctx.stroke();
    } else if (mood === 'sad') {
      ctx.beginPath(); ctx.moveTo(L - er * 1.4, ey - er * 1.2); ctx.lineTo(L + er * 1.2, ey - er * 2.0); ctx.moveTo(R - er * 1.2, ey - er * 2.0); ctx.lineTo(R + er * 1.4, ey - er * 1.2); ctx.stroke();
    }
  }

  function hat(ctx, kind, x, top, r, color, dir) {
    if (!kind || kind === 'none') return;
    ctx.save();
    switch (kind) {
      case 'fedora':
        ctx.fillStyle = color || '#35302b';
        ctx.beginPath(); ctx.ellipse(x, top + r * 0.12, r * 1.05, r * 0.2, 0, 0, 7); ctx.fill();
        JOM.roundRect(ctx, x - r * 0.6, top - r * 0.5, r * 1.2, r * 0.6, r * 0.25); ctx.fill();
        ctx.fillStyle = JOM.shade(color || '#35302b', 0.25);
        ctx.fillRect(x - r * 0.6, top - r * 0.05, r * 1.2, r * 0.12);
        break;
      case 'pillbox':
        ctx.fillStyle = color || '#c9a8a0';
        JOM.roundRect(ctx, x - r * 0.45, top - r * 0.32, r * 0.9, r * 0.42, r * 0.12); ctx.fill();
        break;
      case 'police':
        ctx.fillStyle = color || '#1f2a44';
        ctx.beginPath(); ctx.ellipse(x, top - r * 0.12, r * 0.85, r * 0.38, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(x - r * 0.75, top - r * 0.15, r * 1.5, r * 0.28);
        ctx.beginPath(); ctx.ellipse(x + dir * r * 0.55, top + r * 0.14, r * 0.5, r * 0.12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#d6b54a';
        ctx.beginPath(); ctx.arc(x, top - r * 0.05, r * 0.12, 0, 7); ctx.fill();
        break;
      case 'beanie':
        ctx.fillStyle = color || '#6a5a48';
        ctx.beginPath(); ctx.arc(x, top + r * 0.2, r * 0.82, Math.PI, 0); ctx.fill();
        ctx.fillRect(x - r * 0.86, top + r * 0.1, r * 1.72, r * 0.2);
        break;
      case 'cap':
        ctx.fillStyle = color || '#b8412f';
        ctx.beginPath(); ctx.arc(x, top + r * 0.25, r * 0.8, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + dir * r * 0.75, top + r * 0.22, r * 0.55, r * 0.12, 0, 0, 7); ctx.fill();
        break;
      case 'bun':
        ctx.fillStyle = color || '#3b2d22';
        ctx.beginPath(); ctx.arc(x - dir * r * 0.1, top + r * 0.05, r * 0.36, 0, 7); ctx.fill();
        break;
    }
    ctx.restore();
  }

  function prop(ctx, p, x, cy, y, r, dir, t, color) {
    const hx = x + dir * r * 0.85;
    const ink = '#1d1b18';
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const arm = (tx, ty) => {
      ctx.strokeStyle = JOM.shade(color, -0.3); ctx.lineWidth = Math.max(1.5, r * 0.22);
      ctx.beginPath(); ctx.moveTo(x + dir * r * 0.7, cy + r * 0.2); ctx.lineTo(tx, ty); ctx.stroke();
    };
    switch (p.type) {
      case 'umbrella': {
        const top = cy - r * 2.5;
        arm(hx, cy - r * 0.1);
        ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.12);
        ctx.beginPath(); ctx.moveTo(hx, cy + r * 0.3); ctx.lineTo(hx, top); ctx.stroke();
        ctx.beginPath(); ctx.arc(hx - dir * r * 0.18, cy + r * 0.3, r * 0.18, 0, Math.PI); ctx.stroke();
        const cr = r * 1.7;
        ctx.fillStyle = p.color || '#141414';
        ctx.beginPath();
        ctx.moveTo(hx - cr, top + cr * 0.55);
        ctx.quadraticCurveTo(hx - cr, top - cr * 0.25, hx, top - cr * 0.28);
        ctx.quadraticCurveTo(hx + cr, top - cr * 0.25, hx + cr, top + cr * 0.55);
        for (let i = 0; i < 4; i++) {
          const x1 = hx + cr - (i + 1) * (cr / 2);
          ctx.quadraticCurveTo(x1 + cr / 4, top + cr * 0.3, x1, top + cr * 0.55);
        }
        ctx.fill();
        break;
      }
      case 'umbrellaClosed': {
        ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.14);
        arm(hx, cy + r * 0.4);
        ctx.beginPath(); ctx.moveTo(hx, cy + r * 0.2); ctx.lineTo(hx + dir * r * 0.5, y); ctx.stroke();
        ctx.fillStyle = p.color || '#141414';
        ctx.beginPath(); ctx.moveTo(hx + dir * r * 0.05, cy + r * 0.5); ctx.lineTo(hx + dir * r * 0.55, cy + r * 0.45); ctx.lineTo(hx + dir * r * 0.48, y - r * 0.2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'sign': {
        const sx = x + dir * r * 0.5;
        const top = cy - r * 2.9;
        ctx.strokeStyle = '#6b5236'; ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.beginPath(); ctx.moveTo(sx, cy + r * 0.3); ctx.lineTo(sx, top); ctx.stroke();
        arm(sx, cy - r * 0.1);
        const fs = Math.max(6, r * (p.size || 0.62));
        ctx.font = `700 ${fs}px "Space Mono", monospace`;
        const lines = JOM.wrap(ctx, p.text.toUpperCase(), r * 6.5);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.2;
        const h = lines.length * fs * 1.15 + fs * 0.7;
        ctx.fillStyle = p.bg || '#f3eddc';
        ctx.strokeStyle = ink; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(sx - w / 2, top - h, w, h); ctx.fill(); ctx.stroke();
        ctx.fillStyle = p.fg || '#9e2a1b';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        lines.forEach((l, i) => ctx.fillText(l, sx, top - h + fs * 0.4 + i * fs * 1.15));
        break;
      }
      case 'phone': {
        const px = x + dir * r * 0.75, py = cy - r * (p.up ? 1.5 : 0.4);
        arm(px, py + r * 0.3);
        ctx.fillStyle = '#16171b';
        JOM.roundRect(ctx, px - r * 0.28, py - r * 0.45, r * 0.56, r * 0.9, r * 0.1); ctx.fill();
        ctx.fillStyle = p.glow || '#8fd3ff';
        ctx.fillRect(px - r * 0.2, py - r * 0.36, r * 0.4, r * 0.66);
        if (p.up) {
          ctx.fillStyle = JOM.rgba('#ffffff', 0.12 + 0.08 * Math.sin(t * 6));
          ctx.beginPath(); ctx.arc(px, py, r * 0.9, 0, 7); ctx.fill();
        }
        break;
      }
      case 'report': {
        const bx = x - r * 0.75, by = cy - r * 0.15;
        ctx.fillStyle = '#6d2a24';
        ctx.fillRect(bx, by, r * 1.5, r * 1.15);
        ctx.fillStyle = '#efe6cf';
        ctx.fillRect(bx + r * 1.5, by + r * 0.08, r * 0.14, r * 1.0);
        ctx.fillStyle = '#e6c766';
        ctx.font = `700 ${Math.max(5, r * 0.32)}px "Space Mono", monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('REPORT', bx + r * 0.75, by + r * 0.55);
        break;
      }
      case 'camera': {
        const px = x + dir * r * 0.8, py = cy - r * 0.2;
        arm(px, py);
        ctx.fillStyle = '#26231f';
        ctx.fillRect(px - r * 0.45, py - r * 0.35, r * 0.9, r * 0.6);
        ctx.fillStyle = '#c9c4b8';
        ctx.beginPath(); ctx.arc(px + dir * r * 0.15, py - r * 0.05, r * 0.2, 0, 7); ctx.fill();
        break;
      }
      case 'stick': {
        ctx.strokeStyle = '#444'; ctx.lineWidth = Math.max(1, r * 0.12);
        const ex = x + dir * r * 1.6, ey = cy - r * 2.2;
        arm(x + dir * r * 1.0, cy - r * 0.8);
        ctx.beginPath(); ctx.moveTo(x + dir * r * 0.9, cy - r * 0.6); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = '#16171b';
        ctx.fillRect(ex - r * 0.3, ey - r * 0.45, r * 0.6, r * 0.5);
        break;
      }
      case 'point': {
        arm(x + dir * r * 1.7, cy - r * 0.9);
        break;
      }
    }
    ctx.restore();
  }

  /*
   * o: { x, y (feet), r, color, hat, hatColor, mood, look (-1..1), t, walk, dir, prop, alpha, seed }
   */
  JOM.peep = function (ctx, o) {
    const r = o.r || 10;
    const t = o.t || 0;
    const dir = o.dir || 1;
    const seed = o.seed || 0;
    const color = o.color || '#d9c9a8';
    const bob = o.walk ? Math.abs(Math.sin(t * 9 + seed)) * r * 0.16 : Math.sin(t * 1.6 + seed) * r * 0.025;
    const shake = o.shake ? Math.sin(t * 50 + seed) * r * 0.08 : 0;
    const x = o.x + shake;
    const cy = o.y - r * 1.28 - bob;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(o.x, o.y, r * 0.85, r * 0.2, 0, 0, 7); ctx.fill();
    // legs
    const swing = o.walk ? Math.sin(t * 9 + seed) * r * 0.32 : 0;
    ctx.strokeStyle = JOM.shade(color, -0.45);
    ctx.lineWidth = Math.max(1.5, r * 0.24); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.32, cy + r * 0.7); ctx.lineTo(x - r * 0.32 + swing, o.y - r * 0.05);
    ctx.moveTo(x + r * 0.32, cy + r * 0.7); ctx.lineTo(x + r * 0.32 - swing, o.y - r * 0.05);
    ctx.stroke();
    // props behind the body
    if (o.prop && (o.prop.type === 'sign' || o.prop.type === 'umbrella')) prop(ctx, o.prop, x, cy, o.y, r, dir, t, color);
    // body
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill();
    if (o.scruffy) {
      ctx.fillStyle = JOM.shade(color, -0.2);
      ctx.beginPath(); ctx.arc(x - r * 0.35, cy + r * 0.45, r * 0.18, 0, 7); ctx.arc(x + r * 0.4, cy + r * 0.2, r * 0.14, 0, 7); ctx.fill();
    }
    if (o.tie) {
      ctx.fillStyle = o.tie;
      ctx.beginPath(); ctx.moveTo(x, cy + r * 0.35); ctx.lineTo(x - r * 0.1, cy + r * 0.8); ctx.lineTo(x, cy + r * 0.95); ctx.lineTo(x + r * 0.1, cy + r * 0.8); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, cy - r * 0.35, r * 0.45, 0, 7); ctx.fill();
    if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, cy, r + 1, 0, 7); ctx.stroke(); }
    // face
    const blink = !o.noBlink && ((t * 0.7 + seed * 0.37) % 4) < 0.08;
    eyes(ctx, x + (o.look || 0) * r * 0.22, cy - r * 0.12, r, o.mood || 'calm', o.look || 0, blink);
    hat(ctx, o.hat, x, cy - r * 0.92, r, o.hatColor, dir);
    if (o.prop && !(o.prop.type === 'sign' || o.prop.type === 'umbrella')) prop(ctx, o.prop, x, cy, o.y, r, dir, t, color);
    ctx.restore();
    return { x, cy, r };
  };
})();
