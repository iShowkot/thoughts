/*
 * The Tortoise <-> Rabbit transition.
 *
 * What is on screen right now (text, headings, bullets, capsule links) is drawn to a bitmap and cut into
 * small tiles, so the first frame is indistinguishable from the real page. The real page is hidden, the new
 * mode is swapped in underneath, drawn to a second bitmap, and its tiles gather into place. Only what is
 * visible in the viewport takes part; everything else just swaps underneath.
 *
 *   going to Rabbit:   quick and sharp, tiles rush upward and away; the short facts snap in from below.
 *   going to Tortoise: slow ink; tiles drift off like smoke; the stories settle back in gently.
 */
(function (root) {
  "use strict";

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }

  var vis = new WeakMap();
  function visible(el) {
    if (!el || el === document.body) return true;
    if (vis.has(el)) return vis.get(el);
    var cs = getComputedStyle(el);
    var ok = cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05 && visible(el.parentElement);
    vis.set(el, ok);
    return ok;
  }

  var SKIP = "#side, .mood, script, style, noscript, canvas, .sr-only, .card";

  /* ---------- draw everything visible to one bitmap ---------- */

  function rasterize(dpr) {
    vis = new WeakMap();
    var W = window.innerWidth, H = window.innerHeight;
    var c = document.createElement("canvas");
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    var ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.scale(dpr, dpr);
    ctx.textBaseline = "alphabetic";

    function onScreen(r) { return r.bottom > -4 && r.top < H + 4 && r.right > -4 && r.left < W + 4 && r.width > 0 && r.height > 0; }

    // capsule backgrounds, rules, bullets first
    Array.prototype.forEach.call(document.querySelectorAll(".sec a, .end a, .pop"), function (el) {
      if (!visible(el)) return;
      var r = el.getBoundingClientRect(); if (!onScreen(r)) return;
      var bg = getComputedStyle(el).backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") return;
      ctx.fillStyle = bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(r.left, r.top, r.width, r.height, 6); else ctx.rect(r.left, r.top, r.width, r.height);
      ctx.fill();
    });
    Array.prototype.forEach.call(document.querySelectorAll(".sec hr"), function (el) {
      var r = el.getBoundingClientRect(); if (!onScreen(r)) return;
      ctx.fillStyle = getComputedStyle(el).borderTopColor; ctx.fillRect(r.left, r.top, r.width, 1);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".sec li"), function (el) {
      if (!visible(el)) return;
      var r = el.getBoundingClientRect(); if (!onScreen(r)) return;
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight) || fs * 1.7;
      ctx.fillStyle = cs.color;
      ctx.beginPath(); ctx.arc(r.left - fs * 0.85, r.top + lh / 2, fs * 0.19, 0, Math.PI * 2); ctx.fill();
    });

    // then every visible word, placed exactly where the browser put it
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/\S/.test(n.data)) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest(SKIP) || !visible(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var range = document.createRange(), n;
    while ((n = walker.nextNode())) {
      var cs = getComputedStyle(n.parentElement);
      ctx.font = cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      ctx.fillStyle = cs.color;
      if ("letterSpacing" in ctx && cs.letterSpacing !== "normal") ctx.letterSpacing = cs.letterSpacing; else if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
      var re = /\S+/g, m;
      while ((m = re.exec(n.data))) {
        range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
        var r = range.getBoundingClientRect();
        if (!onScreen(r)) continue;
        var asc = ctx.measureText(m[0]).fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8;
        ctx.fillText(m[0], r.left, r.top + asc);
      }
    }
    return c;
  }

  /* ---------- cut the bitmap into tiles that hold ink ---------- */

  function cut(bmp, dpr, ts) {
    var tsd = Math.round(ts * dpr), W = bmp.width, H = bmp.height;
    var data = bmp.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    var tiles = [];
    for (var ty = 0; ty < H; ty += tsd) {
      for (var tx = 0; tx < W; tx += tsd) {
        var ink = false, x1 = Math.min(W, tx + tsd), y1 = Math.min(H, ty + tsd);
        for (var y = ty; y < y1 && !ink; y += 2) {
          for (var x = tx; x < x1; x += 2) { if (data[(y * W + x) * 4 + 3] > 12) { ink = true; break; } }
        }
        if (ink) tiles.push({
          sx: tx, sy: ty, x: tx / dpr, y: ty / dpr,
          u: tx / W, v: ty / H, r1: Math.random(), r2: Math.random(), r3: Math.random()
        });
      }
    }
    return tiles;
  }

  /* ---------- the two characters ---------- */

  var STYLES = {
    rabbit: {
      outDur: 750, inStart: 400, inDur: 750,
      outSpread: 0.4, inSpread: 0.35,
      outDelay: function (p) { return clamp(p.v * 0.75 + p.r1 * 0.25); },
      inDelay: function (p) { return clamp(p.v * 0.6 + p.r1 * 0.4); },
      out: function (p, s) {
        var e = s * s;
        return { x: p.x + (p.r2 - 0.4) * 44 * e, y: p.y - (30 + p.r3 * 160) * e, k: 1 - 0.55 * s, a: 1 - Math.pow(s, 1.4) };
      },
      inn: function (p, s) {
        var e = outCubic(s);
        return { x: p.x + (p.r2 - 0.5) * 60 * (1 - e), y: p.y + (40 + p.r3 * 110) * (1 - e), k: 0.5 + 0.5 * e, a: Math.min(1, s * 2.5) };
      }
    },
    tortoise: {
      outDur: 1500, inStart: 800, inDur: 1500,
      outSpread: 0.6, inSpread: 0.55,
      outDelay: function (p) { return clamp((p.u * 0.3 + p.v * 0.7) * 0.8 + p.r1 * 0.2); },
      inDelay: function (p) { return clamp((p.u * 0.3 + p.v * 0.7) * 0.8 + p.r1 * 0.2); },
      out: function (p, s) {
        return { x: p.x + Math.sin(s * 3 + p.r1 * 6) * 5 * s + 22 * s * s * p.r2, y: p.y - (16 + p.r3 * 36) * outCubic(s), k: 1 - 0.6 * s, a: Math.pow(1 - s, 1.6) };
      },
      inn: function (p, s) {
        var e = outCubic(s);
        return { x: p.x - (14 + p.r2 * 16) * (1 - e) + Math.sin(s * 3 + p.r1 * 6) * 3 * (1 - e), y: p.y + (8 + p.r3 * 26) * (1 - e), k: 0.6 + 0.4 * e, a: Math.min(1, s * 2) };
      }
    }
  };

  /* ---------- run ---------- */

  var locked = false;
  function stop(e) { e.preventDefault(); }
  function lock() { if (locked) return; locked = true; window.addEventListener("wheel", stop, { passive: false }); window.addEventListener("touchmove", stop, { passive: false }); }
  function unlock() { locked = false; window.removeEventListener("wheel", stop, { passive: false }); window.removeEventListener("touchmove", stop, { passive: false }); }

  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }

  /* opts: { to: "rabbit" | "tortoise", swap: function () -> Promise } resolves when the page is real again */
  function transition(opts) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = window.innerWidth, H = window.innerHeight;
    var ts = W * H > 1200000 ? 8 : 6;
    var style = STYLES[opts.to] || STYLES.tortoise;
    var canvas = null;

    function finish() {
      document.body.classList.remove("morphing");
      unlock();
      if (canvas) {
        var c = canvas; canvas = null;
        c.style.transition = "opacity .14s ease"; c.style.opacity = "0";
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 180);
      }
    }

    try {
      lock();
      var oldBmp = rasterize(dpr), oldTiles = cut(oldBmp, dpr, ts);

      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:45";
      var ctx = canvas.getContext("2d");
      var tsd = Math.round(ts * dpr);

      function drawTile(bmp, p, o) {
        if (o.a <= 0.01) return;
        var sz = tsd * o.k;
        ctx.globalAlpha = o.a;
        ctx.drawImage(bmp, p.sx, p.sy, tsd, tsd, o.x * dpr + (tsd - sz) / 2 - 0, o.y * dpr + (tsd - sz) / 2, sz, sz);
      }
      function drawOld(t) {
        for (var i = 0; i < oldTiles.length; i++) {
          var p = oldTiles[i], sp = style.outSpread;
          var s = clamp((t - style.outDelay(p) * sp) / (1 - sp));
          drawTile(oldBmp, p, s <= 0 ? { x: p.x, y: p.y, k: 1, a: 1 } : style.out(p, s));
        }
      }

      // first frame: the old page, as tiles, in the same paint that hides the real one
      document.body.appendChild(canvas);
      drawOld(0);
      document.body.classList.add("morphing");

      return Promise.resolve(opts.swap()).then(frame).then(function () {
        // the real page is hidden while its tiles play; un-hide it for the instant it takes to draw it (no paint happens in between)
        document.body.classList.remove("morphing");
        var newBmp = rasterize(dpr);
        document.body.classList.add("morphing");
        var newTiles = cut(newBmp, dpr, ts);
        var t0 = performance.now(), total = style.inStart + style.inDur;

        return new Promise(function (resolve) {
          function tick(now) {
            var el = now - t0;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (el < style.outDur) drawOld(el / style.outDur);
            var ti = (el - style.inStart) / style.inDur;
            if (ti > -0.001) {
              for (var i = 0; i < newTiles.length; i++) {
                var p = newTiles[i], sp = style.inSpread;
                var s = clamp((ti - style.inDelay(p) * sp) / (1 - sp));
                if (ti < style.inDelay(p) * sp) continue;
                drawTile(newBmp, p, style.inn(p, s));
              }
            }
            ctx.globalAlpha = 1;
            if (el < total) requestAnimationFrame(tick); else resolve();
          }
          requestAnimationFrame(tick);
        });
      }).then(function () { finish(); }, function () { finish(); });
    } catch (e) {
      finish();
      return Promise.resolve();
    }
  }

  root.Morph = { transition: transition };
})(typeof window !== "undefined" ? window : this);
