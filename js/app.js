(function () {
  "use strict";

  var SECTIONS = [
    { id: "hi", label: "Hi" },
    { id: "education", label: "Education" },
    { id: "designs", label: "Designs" },
    { id: "poetry", label: "Poetry" },
    { id: "artworks", label: "Artworks" },
    { id: "infinity", label: "Infinity" }
  ];
  var MODES = ["tortoise", "rabbit"];
  var DEFAULT_MODE = "tortoise";

  var page = document.getElementById("page");
  var side = document.getElementById("side");
  var endEl = document.getElementById("end");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cache = {};
  var site = {};
  var popovers = null;
  var mode = null;          // the mode currently on screen
  var active = "hi";        // the section currently being read
  var lockSpy = false;      // ignore the scroll spy while we scroll somewhere on purpose
  var sectionEls = {};
  var juggled = false;      // the opening line plays each time a mode is shown, when you can actually see it
  var juggleWatch = null;

  /* ---------- small helpers ---------- */

  function get(kind, key) { try { return window[kind].getItem(key); } catch (e) { return null; } }
  function set(kind, key, val) { try { window[kind].setItem(key, val); } catch (e) { /* private mode */ } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function fetchText(url) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    });
    cache[url].catch(function () { delete cache[url]; });
    return cache[url];
  }
  function fetchJson(url) { return fetchText(url).then(function (t) { return JSON.parse(t); }); }

  /* ---------- dev mode: ?dev (or localhost) makes placeholders visible ---------- */
  var host = location.hostname;
  if (/[?&]dev\b/.test(location.search) || host === "localhost" || host === "127.0.0.1") {
    document.body.classList.add("dev");
  }

  /* ---------- addresses: #section-mode (old #section/mode still works) ---------- */

  function parseHash() {
    var parts = location.hash.replace(/^#/, "").split(/[\/-]/);
    var section = SECTIONS.some(function (s) { return s.id === parts[0]; }) ? parts[0] : "hi";
    var m = MODES.indexOf(parts[1]) > -1 ? parts[1] : null;
    if (!m) {
      var saved = get("localStorage", "mode");
      m = MODES.indexOf(saved) > -1 ? saved : DEFAULT_MODE;
    }
    return { section: section, mode: m };
  }
  function hashFor(section, m) { return "#" + section + "-" + m; }

  var hashTimer = null;
  function writeHash(section, m, now) {
    var h = hashFor(section, m);
    clearTimeout(hashTimer);
    var go = function () {
      if (location.hash === h) return;
      try { history.replaceState(null, "", h); } catch (e) { /* sandboxed frame */ }
    };
    if (now) go(); else hashTimer = setTimeout(go, 300);   // never touch the address bar mid-scroll
  }

  /* ---------- the page is one long scroll: a section per tab, snapping one by one ---------- */

  function buildSkeleton() {
    SECTIONS.forEach(function (s) {
      var sec = document.createElement("section");
      sec.className = "sec";
      sec.id = s.id;
      sec.setAttribute("aria-label", s.label);
      page.appendChild(sec);
      sectionEls[s.id] = sec;

      var a = document.createElement("a");
      a.dataset.id = s.id;
      a.textContent = s.label;
      a.href = hashFor(s.id, DEFAULT_MODE);
      side.appendChild(a);
    });
  }

  function markActive(section) {
    active = section;
    Array.prototype.forEach.call(side.children, function (a) {
      a.href = hashFor(a.dataset.id, mode || DEFAULT_MODE);
      if (a.dataset.id === section) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
    var label = SECTIONS.filter(function (s) { return s.id === section; })[0].label;
    document.title = section === "hi" ? "Showkot Shawon" : label + " · Showkot Shawon";
  }

  var lastPainted = null;
  function markMode(m) {
    var now = m || mode;
    if (lastPainted !== null && lastPainted !== now && !reduceMotion) {      // the chosen animal moves
      var btn = document.querySelector('.mood .ico[data-mode="' + now + '"]');
      if (btn) { btn.classList.remove("go"); void btn.offsetWidth; btn.classList.add("go"); setTimeout(function () { btn.classList.remove("go"); }, 3400); }
    }
    lastPainted = now;
    var mood = document.querySelector(".mood"); if (mood) mood.setAttribute("data-mode", m || mode);
    Array.prototype.forEach.call(document.querySelectorAll(".mood .ico"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === (m || mode)));
    });
  }

  function renderAll(m) {
    mode = m;
    juggled = false;                                // every switch plays the opening line again, in either mode
    set("localStorage", "mode", m);
    markMode();
    return Promise.all(SECTIONS.map(function (s) {
      return fetchText("content/" + s.id + "." + m + ".md").catch(function () { return null; });
    }).concat([fetchJson("content/site.json").catch(function () { return {}; })])).then(function (res) {
      if (mode !== m) return;                       // the reader already switched again
      site = res[res.length - 1];
      SECTIONS.forEach(function (s, i) {
        var md = res[i];
        sectionEls[s.id].innerHTML = '<div class="in">' + (md === null ? "<p>This page isn't written yet.</p>" : MD.render(md)) + "</div>";
      });
      renderEnd(m);
      var j = page.querySelector(".juggle");
      if (juggleWatch) { juggleWatch.disconnect(); juggleWatch = null; }
      if (j && willPlay() && !("IntersectionObserver" in window)) startJuggle(j);
      else if (j && willPlay()) {
        prepJuggle(j);
        juggleWatch = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) {
            juggleWatch.disconnect(); juggleWatch = null;
            (function go() { if (morphing) return setTimeout(go, 250); startJuggle(j); })();
          }
        }, { threshold: 0.9 });
        juggleWatch.observe(j);
      }
    });
  }

  function goTo(section, instant) {
    var el = sectionEls[section];
    if (!el) return;
    lockSpy = true;
    markActive(section);
    el.scrollIntoView({ behavior: instant || reduceMotion ? "auto" : "smooth", block: "start" });
    setTimeout(function () { lockSpy = false; }, instant || reduceMotion ? 80 : 900);
  }

  var morphing = false;

  function route() {
    if (morphing) return;                         // the latest address is picked up when the transition ends
    var r = parseHash();
    closeCard();
    if (r.mode !== mode) {
      var swap = function () {
        return renderAll(r.mode).then(function () {
          writeHash(r.section, r.mode, true);
          goTo(r.section, true);
        });
      };
      if (mode !== null && !reduceMotion && window.Morph) {
        morphing = true;
        Morph.transition({ to: r.mode, swap: swap }).then(function () {
          morphing = false;
          route();                                    // in case the address changed meanwhile
        });
      } else {
        page.classList.add("fading");
        var fade = mode === null || reduceMotion ? Promise.resolve() : sleep(180);
        fade.then(swap).then(function () { page.classList.remove("fading"); });
      }
    } else {
      writeHash(r.section, r.mode, true);
      goTo(r.section, false);
    }
  }

  // which section is under the middle of the screen
  var spy = new IntersectionObserver(function (entries) {
    if (lockSpy) return;
    entries.forEach(function (e) {
      if (e.isIntersecting && e.target.id !== active) {
        markActive(e.target.id);
        writeHash(e.target.id, mode);
      }
    });
  }, { rootMargin: "-45% 0px -54% 0px" });

  function renderEnd(m) {
    var bits = [];
    if (site && site.email) bits.push('<span><a href="mailto:' + site.email + '">Write to me</a></span>');
    ((site && site.links) || []).forEach(function (l) {
      bits.push('<span><a href="' + l.url + '" target="_blank" rel="noopener noreferrer">' + l.label + "</a></span>");
    });
    if (m === "rabbit" && site && site.cv) bits.push('<span><a href="' + site.cv + '">CV (PDF)</a></span>');
    endEl.className = "end" + (site && site.placeholder ? " ph" : "");
    endEl.innerHTML = bits.join("");
    endEl.hidden = bits.length === 0;
  }

  /* ---------- the opening line: words arrive one by one, each disintegrates in its own way,
     and only the last (Thinker) stays. Once per visit. ---------- */

  function juggleWords(slot) { return Array.prototype.slice.call(slot.querySelectorAll(".w")); }

  // Put the line in its starting state: the first word is already on screen (never an empty gap),
  // and the slot is frozen at the widest word so the sentence around it will not move.
  function prepJuggle(slot) {
    var words = juggleWords(slot);
    if (words.length < 2) return false;
    var keep = words[words.length - 1], first = words[0];
    var widest = 0;
    words.forEach(function (w) { widest = Math.max(widest, w.getBoundingClientRect().width); });
    slot.style.width = Math.ceil(widest) + "px";
    keep.style.transition = "none"; first.style.transition = "none";
    slot.classList.add("playing");
    words.forEach(function (w) { w.classList.remove("on"); });
    first.classList.add("on");
    void slot.offsetWidth;
    keep.style.transition = ""; first.style.transition = "";
    return true;
  }

  function willPlay() { return !juggled && !reduceMotion && !!window.Burst; }

  function startJuggle(slot) {
    if (!willPlay()) return;
    juggled = true;
    if (!slot.classList.contains("playing") && !prepJuggle(slot)) return;

    var words = juggleWords(slot);
    var keep = words[words.length - 1];
    // fonts may have settled since the slot was prepared: re-measure so the slot is exactly the widest word
    var widest = 0;
    words.forEach(function (w) { widest = Math.max(widest, w.getBoundingClientRect().width); });
    slot.style.width = Math.ceil(widest) + "px";

    var stage = Burst.create(slot);
    function alive() { return slot.isConnected; }

    var chain = sleep(900);                              // the first word has been sitting there; give it a beat
    words.slice(0, -1).forEach(function (w, i) {
      chain = chain.then(function () {
        if (!alive()) return;
        if (i > 0) w.classList.add("on");
        return sleep(i > 0 ? 1000 : 0).then(function () {   // arrives, is read, then leaves
          if (!alive()) return;
          return stage.out(w, Burst.forWord(w.textContent));
        });
      });
    });
    chain.then(function () {
      if (!alive()) return;
      return stage.gather(keep);
    }).then(function () {
      if (!alive()) return;
      keep.classList.add("on");
      return sleep(500);
    }).then(function () {
      stage.destroy();
      if (!alive()) return;
      slot.classList.remove("playing");
      words.forEach(function (w) { w.classList.remove("on"); w.style.transition = ""; w.style.opacity = ""; });
    });
  }

  /* ---------- popover cards ---------- */

  var card = null, trigger = null;

  function closeCard(restoreFocus) {
    if (card) { card.remove(); card = null; }
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) trigger.focus();
      trigger = null;
    }
  }

  function openCard(btn) {
    var key = btn.dataset.pop;
    var ready = popovers ? Promise.resolve(popovers) : fetchJson("content/popovers.json").catch(function () { return {}; });
    ready.then(function (data) {
      popovers = data;
      var d = data[key];
      if (!d) return;
      closeCard();

      card = document.createElement("div");
      card.className = "card" + (d.placeholder ? " ph" : "");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", d.title || btn.textContent);
      card.tabIndex = -1;

      var html = "";
      if (d.image) html += '<img src="' + d.image + '" alt="' + (d.alt || "") + '">';
      if (d.title) html += "<h3>" + MD.inline(d.title) + "</h3>";
      if (d.text) html += "<p>" + MD.inline(d.text) + "</p>";
      if (d.link) html += '<p><a href="' + d.link.url + '" target="_blank" rel="noopener noreferrer">' + d.link.label + "</a></p>";
      card.innerHTML = html;
      document.body.appendChild(card);

      var r = btn.getBoundingClientRect();
      var left = Math.max(8, Math.min(r.left + window.scrollX, document.documentElement.clientWidth - card.offsetWidth - 8));
      card.style.left = left + "px";
      card.style.top = (r.bottom + window.scrollY + 8) + "px";

      trigger = btn;
      btn.setAttribute("aria-expanded", "true");
      card.focus({ preventScroll: true });
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".pop");
    if (btn) {
      if (trigger === btn) closeCard(); else openCard(btn);
      return;
    }
    if (card && !card.contains(e.target)) closeCard();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && card) closeCard(true);
  });

  document.addEventListener("focusin", function (e) {
    if (card && !card.contains(e.target) && e.target !== trigger) closeCard();
  });

  window.addEventListener("resize", function () { closeCard(); });

  /* ---------- switch + boot ---------- */

  function setMode(m) {
    if (m === mode) return;
    markMode(m);                          // the switcher answers at once, before the page does
    location.hash = hashFor(active, m);   // stay in the same section, read it the other way
  }
  Array.prototype.forEach.call(document.querySelectorAll(".mood .ico"), function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.mode); });
  });

  side.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    location.hash = hashFor(a.dataset.id, mode || DEFAULT_MODE);
  });

  buildSkeleton();
  SECTIONS.forEach(function (s) { spy.observe(sectionEls[s.id]); });
  window.addEventListener("hashchange", route);
  route();
})();
