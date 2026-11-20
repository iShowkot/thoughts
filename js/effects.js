/*
 * Word disintegration effects for the opening line.
 *
 * Each word is drawn to a small canvas that sits exactly over its slot, sampled into
 * particles that sit precisely where the glyph pixels were, and then each word leaves
 * in its own way (shapes, paint, ink, dust, scan, sparks). The last word is gathered
 * back together from scattered particles. Nothing outside the slot's own area is
 * touched and the slot never changes size, so the text around it never moves.
 */
(function (root) {
  "use strict";

  var TAU = Math.PI * 2;
  var INK = "#1F1D1A", BLUE = "#1D3FBF";

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function rnd() { return Math.random(); }

  /* ---------------- effects ----------------
     init(p, sys): once per particle. p.x, p.y is where the glyph pixel was; p.u, p.v are 0..1 across the word.
     draw(ctx, p, s, sys): s runs 0..1 for that particle (after its own delay p.d * spread).
     At s = 0 every effect must look like the plain glyph pixel, so the swap from real text is invisible. */

  var SHAPE_COLORS = [BLUE, INK, "#5B79E0", "#9DB0F2", "#E4572E"];

  var EFFECTS = {

    // Designer: the letters break into geometric shapes that burst outward
    shapes: {
      stride: 1.9, dur: 1050, spread: 0.22,
      init: function (p, sys) {
        p.a = Math.atan2(p.y - sys.cy, p.x - sys.cx) + (rnd() - 0.5) * 1.5;
        p.dist = 14 + rnd() * 40;
        p.rot0 = rnd() * TAU; p.spin = (rnd() - 0.5) * 9;
        p.size = 2.6 + rnd() * 4.2; p.shape = (rnd() * 4) | 0;
        p.col = SHAPE_COLORS[(rnd() * SHAPE_COLORS.length) | 0];
        p.d = rnd();
      },
      draw: function (ctx, p, s, sys) {
        if (s >= 1) return;
        var e = outCubic(s);
        var x = p.x + Math.cos(p.a) * p.dist * e;
        var y = p.y + Math.sin(p.a) * p.dist * e * 0.85;
        var grow = clamp(s * 5);
        var sz = (sys.stride + (p.size - sys.stride) * grow) * (1 - s * 0.45);
        ctx.globalAlpha = s < 0.45 ? 1 : 1 - (s - 0.45) / 0.55;
        ctx.fillStyle = s < 0.05 ? INK : p.col;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot0 * grow + p.spin * s);
        if (p.shape === 0) ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, TAU); ctx.fill(); }
        else if (p.shape === 2) { ctx.beginPath(); ctx.moveTo(0, -sz * 0.6); ctx.lineTo(sz * 0.55, sz * 0.4); ctx.lineTo(-sz * 0.55, sz * 0.4); ctx.closePath(); ctx.fill(); }
        else ctx.fillRect(-sz, -0.6, sz * 2, 1.3);
        ctx.restore();
      }
    },

    // Artist: a spray of paint, coloured along the spectrum, thrown up and falling
    paint: {
      stride: 1.2, dur: 1150, spread: 0.12,
      init: function (p) {
        p.col = "hsl(" + Math.round(p.u * 310 + rnd() * 24) + ",86%,52%)";
        var a = -Math.PI / 2 + (rnd() - 0.5) * 2.7, sp = 26 + rnd() * 84;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 10;
        p.r = 1.1 + rnd() * 2.3;
        p.g = 150;
        if (rnd() < 0.12) { p.vx *= 0.12; p.vy = rnd() * 18; p.r = 2 + rnd() * 1.4; p.g = 70; }   // drips
        p.d = rnd();
      },
      draw: function (ctx, p, s) {
        if (s >= 1) return;
        var t = s * 1.0;
        ctx.globalAlpha = 1 - Math.pow(s, 2.6);
        ctx.fillStyle = s < 0.03 ? INK : p.col;
        var r0 = 0.7, bloom = clamp(s * 6);
        ctx.beginPath();
        ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 0.5 * p.g * t * t, (r0 + (p.r - r0) * bloom) * (1 - 0.35 * s), 0, TAU);
        ctx.fill();
      }
    },

    // Poet: the line unspools left to right into ink that drifts off like smoke
    ink: {
      stride: 1.0, dur: 1300, spread: 0.55,
      init: function (p) {
        p.d = clamp(p.u * 0.86 + rnd() * 0.14);
        p.ph = rnd() * TAU; p.k = rnd(); p.dx = (rnd() - 0.3) * 14;
      },
      draw: function (ctx, p, s) {
        if (s >= 1) return;
        ctx.globalAlpha = Math.pow(1 - s, 1.7) * 0.95;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(s * 4.5 + p.ph) * 5 * s + p.dx * s,
                p.y - 22 * outCubic(s) * (0.45 + p.k),
                0.7 + s * 1.5, 0, TAU);
        ctx.fill();
      }
    },

    // Writer: the page turns to sand, blowing away in reading direction
    dust: {
      stride: 0.9, dur: 1250, spread: 0.7,
      init: function (p) {
        p.d = clamp(p.u * 0.7 + rnd() * 0.3);
        p.k = rnd(); p.k2 = rnd(); p.ph = rnd() * TAU;
      },
      draw: function (ctx, p, s) {
        if (s >= 1) return;
        ctx.globalAlpha = 1 - Math.pow(s, 1.3);
        ctx.fillStyle = INK;
        var sz = 1.15 * (1 - s * 0.4);
        ctx.fillRect(p.x + (16 + p.k * 30) * s * s + Math.sin(s * 7 + p.ph) * 1.2,
                     p.y - (8 * p.k2 - 4) * s - 6 * s * s * p.k2,
                     sz, sz);
      }
    },

    // Observer: a scan line glitch and a ripple, like focus pulling away
    scan: {
      stride: 0.9, dur: 1000, spread: 0.5,
      init: function (p, sys) {
        var row = Math.floor(p.y * 1.4);
        sys.rows = sys.rows || {};
        if (sys.rows[row] === undefined) sys.rows[row] = rnd() - 0.5;
        p.off = sys.rows[row];
        p.d = clamp(p.v * 0.8 + rnd() * 0.15);
        p.k = rnd();
      },
      draw: function (ctx, p, s) {
        if (s >= 1) return;
        var flick = s > 0.02 && rnd() < 0.1 + s * 0.45 ? 0.25 : 1;
        ctx.globalAlpha = (1 - s) * flick;
        ctx.fillStyle = p.k < 0.3 && s > 0.02 ? BLUE : INK;
        ctx.fillRect(p.x + p.off * s * 34, p.y, 1 + s * s * 11 * p.k, 1);
      },
      overlay: function (ctx, t, sys) {
        if (t <= 0.04 || t >= 0.95) return;
        var r = outCubic(t) * Math.max(sys.w, 50) * 0.42;
        ctx.globalAlpha = 0.5 * (1 - t);
        ctx.strokeStyle = BLUE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, r * 1.5, r * 0.55, 0, 0, TAU); ctx.stroke();
      }
    },

    // Mentor: sparks lifting upward, leaving a faint trail
    sparks: {
      stride: 1.4, dur: 1250, spread: 0.35,
      init: function (p) {
        p.d = rnd(); p.rise = 22 + rnd() * 40; p.ph = rnd() * TAU; p.sx = (rnd() - 0.5) * 12;
      },
      draw: function (ctx, p, s) {
        if (s >= 1) return;
        function pos(q) { return [p.x + Math.sin(q * 5 + p.ph) * 4 + p.sx * q, p.y - p.rise * Math.pow(q, 1.5)]; }
        var a = pos(s), b = pos(Math.max(0, s - 0.08));
        var col = s < 0.35 ? INK : s < 0.7 ? BLUE : "#8FA6F0";
        ctx.globalAlpha = (1 - s) * 0.9;
        ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(a[0], a[1], 1.1 * (1 - s * 0.4), 0, TAU); ctx.fill();
      }
    },

    // The one that stays: gathered back together out of scattered particles
    gather: {
      stride: 0.5, dur: 1100, spread: 0.5,
      init: function (p) {
        var a = rnd() * TAU, d = 16 + rnd() * 40;
        p.sx = p.x + Math.cos(a) * d; p.sy = p.y + Math.sin(a) * d * 0.7;
        p.d = rnd();
      },
      draw: function (ctx, p, s) {
        var e = outCubic(s);
        ctx.globalAlpha = Math.min(1, s * 3);
        ctx.fillStyle = INK;
        var q = 0.85;
        ctx.fillRect(p.sx + (p.x - p.sx) * e, p.sy + (p.y - p.sy) * e, q, q);
      }
    }
  };

  var BY_WORD = { designer: "shapes", artist: "paint", poet: "ink", writer: "dust", observer: "scan", mentor: "sparks" };

  /* ---------------- stage ---------------- */

  function Stage(slot) {
    this.slot = slot;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.padX = 44; this.padY = 52;
    var r = slot.getBoundingClientRect();
    this.cw = Math.ceil(r.width + this.padX * 2);
    this.ch = Math.ceil(r.height + this.padY * 2);

    var c = document.createElement("canvas");
    c.width = Math.round(this.cw * this.dpr); c.height = Math.round(this.ch * this.dpr);
    c.setAttribute("aria-hidden", "true");
    c.style.cssText = "position:absolute;pointer-events:none;z-index:2;" +
      "left:" + (-this.padX) + "px;top:" + (-this.padY) + "px;width:" + this.cw + "px;height:" + this.ch + "px";
    slot.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext("2d");
    this.systems = [];
    this.raf = 0;
    this.off = document.createElement("canvas");
    this.off.width = c.width; this.off.height = c.height;
    var self = this;
    this.tick = function () { self.frame(performance.now()); };
  }

  // turn the word on screen into one particle per sampled glyph pixel
  Stage.prototype.sample = function (wordEl, stride) {
    var dpr = this.dpr, ctx = this.off.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.off.width, this.off.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cs = getComputedStyle(wordEl);
    var text = wordEl.textContent;
    ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    ctx.fillStyle = INK;
    ctx.textBaseline = "alphabetic";

    var range = document.createRange();
    range.selectNodeContents(wordEl);
    var tr = range.getBoundingClientRect(), sr = this.slot.getBoundingClientRect();
    var m = ctx.measureText(text);
    var asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
    var x0 = tr.left - sr.left + this.padX;
    var base = tr.top - sr.top + this.padY + asc;
    ctx.fillText(text, x0, base);

    var step = Math.max(1, Math.round(stride * dpr));
    var data = ctx.getImageData(0, 0, this.off.width, this.off.height).data, W = this.off.width, H = this.off.height;
    var parts = [], minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 110) {
          var px = x / dpr, py = y / dpr;
          parts.push({ x: px, y: py });
          if (px < minx) minx = px; if (px > maxx) maxx = px;
          if (py < miny) miny = py; if (py > maxy) maxy = py;
        }
      }
    }
    var w = Math.max(1, maxx - minx), h = Math.max(1, maxy - miny);
    parts.forEach(function (p) { p.u = (p.x - minx) / w; p.v = (p.y - miny) / h; });
    return { parts: parts, cx: minx + w / 2, cy: miny + h / 2, w: w, h: h, stride: stride };
  };

  var SLOW = 1.9;                               // the words change at a readable pace

  Stage.prototype.start = function (wordEl, name, afterFraction) {
    var self = this, e = EFFECTS[name] || EFFECTS.dust;
    var s = this.sample(wordEl, e.stride);
    var sys = { e: e, parts: s.parts, cx: s.cx, cy: s.cy, w: s.w, h: s.h, stride: e.stride, dur: e.dur * SLOW, t0: performance.now(), done: null };
    s.parts.forEach(function (p) { e.init(p, sys); });

    var finished = new Promise(function (res) { sys.done = res; });
    var half = new Promise(function (res) { setTimeout(res, e.dur * SLOW * afterFraction); });
    this.systems.push(sys);
    this.frame(sys.t0);                      // draw the first frame before the real text is hidden
    return { half: half, finished: finished };
  };

  Stage.prototype.frame = function (now) {
    var ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var alive = [];
    for (var i = 0; i < this.systems.length; i++) {
      var sys = this.systems[i], e = sys.e;
      var t = clamp((now - sys.t0) / sys.dur), sp = e.spread, parts = sys.parts;
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        e.draw(ctx, p, clamp((t - p.d * sp) / (1 - sp)), sys);
      }
      if (e.overlay) e.overlay(ctx, t, sys);
      ctx.globalAlpha = 1;
      if (t >= 1) sys.done(); else alive.push(sys);
    }
    this.systems = alive;
    this.raf = alive.length ? requestAnimationFrame(this.tick) : 0;
  };

  Stage.prototype.loopIfNeeded = function () {
    if (!this.raf && this.systems.length) this.raf = requestAnimationFrame(this.tick);
  };

  // the word leaves: hide the real text and let its particles go. Resolves partway through, so the next word can begin.
  Stage.prototype.out = function (wordEl, name) {
    var r = this.start(wordEl, name, 0.42);
    wordEl.style.transition = "none"; wordEl.style.opacity = "0";
    wordEl.classList.remove("on");
    this.loopIfNeeded();
    r.finished.then(function () { wordEl.style.transition = ""; wordEl.style.opacity = ""; });
    return r.half;
  };

  // the final word arrives out of particles; resolves when they have all landed
  Stage.prototype.gather = function (wordEl) {
    // the real text is still invisible (opacity 0), but it has its layout box, so it can be sampled
    var r = this.start(wordEl, "gather", 1);
    this.loopIfNeeded();
    return r.finished;
  };

  Stage.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  };

  root.Burst = {
    create: function (slot) { return new Stage(slot); },
    forWord: function (text) { return BY_WORD[String(text).toLowerCase().replace(/^an?\s+/, "")] || "dust"; }
  };
})(typeof window !== "undefined" ? window : this);
