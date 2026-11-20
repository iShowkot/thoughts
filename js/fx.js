/*
 * Little reactions for links and popover words: a burst of colour where you click,
 * and a few sparks where the pointer arrives. The colours are picked to suit the link.
 * A first version; the palettes below are the place to make it more contextual.
 */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var canHover = window.matchMedia && window.matchMedia("(hover: hover)").matches;

  var TAU = Math.PI * 2;
  var PALETTES = {
    blue:    function () { return ["#1D3FBF", "#4F6FE8", "#9DB0F2", "#E4572E", "#F2B84B"][(Math.random() * 5) | 0]; },
    rainbow: function () { return "hsl(" + Math.round(Math.random() * 360) + ",88%,56%)"; },
    warm:    function () { return ["#E4572E", "#F2B84B", "#F28C6B", "#1D3FBF"][(Math.random() * 4) | 0]; }
  };

  // which colours suit which link
  function paletteFor(el) {
    var key = (el.dataset && el.dataset.pop) || "";
    var href = el.getAttribute && el.getAttribute("href") || "";
    if (/^artwork/.test(key) || /showkotshawon/.test(href)) return PALETTES.rainbow;   // art: every colour
    if (/^mailto:/.test(href)) return PALETTES.warm;                                   // writing to me: warm
    return PALETTES.blue;
  }

  var canvas = null, ctx = null, parts = [], raf = 0, last = 0, dpr = 1;

  function ensure() {
    if (canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:50";
    sizeCanvas();
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  function sizeCanvas() {
    if (!canvas) return;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }
  window.addEventListener("resize", sizeCanvas);

  function burst(x, y, pick, n, power) {
    ensure();
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = (60 + Math.random() * 190) * power;
      parts.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70 * power,
        life: 0, max: 0.55 + Math.random() * 0.5,
        size: 2 + Math.random() * 3.2, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 12,
        shape: (Math.random() * 3) | 0, col: pick()
      });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var alive = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy += 520 * dt; p.vx *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      var k = p.life / p.max;
      ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      ctx.fillStyle = p.col;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, TAU); ctx.fill(); }
      else ctx.fillRect(-p.size, -0.7, p.size * 2, 1.4);
      ctx.restore();
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    parts = alive;
    if (parts.length) raf = requestAnimationFrame(loop);
    else { raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function target(e) {
    return e.target.closest && e.target.closest(".sec a, .end a, .card a, .pop");
  }
  function origin(e, el) {
    if (e.clientX || e.clientY) return [e.clientX, e.clientY];
    var r = el.getBoundingClientRect();            // keyboard activation: burst from the middle
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  document.addEventListener("click", function (e) {
    var el = target(e); if (!el) return;
    var o = origin(e, el);
    burst(o[0], o[1], paletteFor(el), 26, 1);
  }, true);

  if (canHover) {
    var lastEl = null;
    document.addEventListener("pointerover", function (e) {
      var el = target(e);
      if (!el || el === lastEl) return;
      lastEl = el;
      var r = el.getBoundingClientRect(), pick = paletteFor(el);
      burst(r.left + Math.random() * r.width, r.top + 2, pick, 5, 0.35);
    });
    document.addEventListener("pointerout", function (e) {
      var el = target(e);
      if (el && el === lastEl && !el.contains(e.relatedTarget)) lastEl = null;
    });
  }
})();
