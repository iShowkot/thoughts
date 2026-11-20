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
  var tabBars = [document.getElementById("tabs-top"), document.getElementById("tabs-foot")];
  var track = document.getElementById("track");
  var endEl = document.getElementById("end");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var cache = {};
  var site = null;
  var popovers = null;
  var current = { section: null, mode: null };

  /* ---------- small helpers ---------- */

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function get(kind, key) { try { return store(kind).getItem(key); } catch (e) { return null; } }
  function set(kind, key, val) { try { store(kind).setItem(key, val); } catch (e) { /* private mode */ } }

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
  function fetchJson(url) {
    return fetchText(url).then(function (t) { return JSON.parse(t); });
  }

  /* ---------- dev mode: ?dev (or localhost) makes placeholders visible ---------- */
  var host = location.hostname;
  if (/[?&]dev\b/.test(location.search) || host === "localhost" || host === "127.0.0.1") {
    document.body.classList.add("dev");
  }

  /* ---------- routing: #section/mode ---------- */

  function parseHash() {
    var parts = location.hash.replace(/^#/, "").split(/[\/-]/);   // #education-rabbit (old #education/rabbit still works)
    var section = SECTIONS.some(function (s) { return s.id === parts[0]; }) ? parts[0] : "hi";
    var mode = MODES.indexOf(parts[1]) > -1 ? parts[1] : null;
    if (!mode) {
      var saved = get("localStorage", "mode");
      mode = MODES.indexOf(saved) > -1 ? saved : DEFAULT_MODE;
    }
    return { section: section, mode: mode };
  }

  function hashFor(section, mode) { return "#" + section + "-" + mode; }

  function buildTabs(mode) {
    tabBars.forEach(function (bar) {
      bar.innerHTML = "";
      SECTIONS.forEach(function (s) {
        var a = document.createElement("a");
        a.href = hashFor(s.id, mode);
        a.textContent = s.label;
        a.dataset.id = s.id;
        bar.appendChild(a);
      });
    });
  }

  function markActive(section, mode) {
    tabBars.forEach(function (bar) {
      Array.prototype.forEach.call(bar.children, function (a) {
        a.href = hashFor(a.dataset.id, mode);
        if (a.dataset.id === section) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".switch .lab"), function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    track.setAttribute("aria-checked", String(mode === "rabbit"));
  }

  function route() {
    var r = parseHash();
    var wanted = hashFor(r.section, r.mode);
    if (location.hash !== wanted) { try { history.replaceState(null, "", wanted); } catch (e) { location.hash = wanted; } }
    show(r.section, r.mode);
  }

  /* ---------- rendering ---------- */

  function show(section, mode) {
    closeCard();
    var changed = current.section !== null && (current.section !== section || current.mode !== mode);
    current = { section: section, mode: mode };
    set("localStorage", "mode", mode);
    markActive(section, mode);

    var label = SECTIONS.filter(function (s) { return s.id === section; })[0].label;
    document.title = section === "hi" ? "Showkot Shawon" : label + " · Showkot Shawon";

    var load = Promise.all([
      fetchText("content/" + section + "." + mode + ".md").catch(function () { return null; }),
      site ? Promise.resolve(site) : fetchJson("content/site.json").catch(function () { return {}; })
    ]);

    var fade = changed && !reduceMotion ? (page.classList.add("fading"), sleep(180)) : Promise.resolve();

    Promise.all([load, fade]).then(function (res) {
      // ignore stale results if the reader has already moved on
      if (current.section !== section || current.mode !== mode) return;
      var md = res[0][0];
      site = res[0][1];

      page.innerHTML = md === null
        ? "<p>This page isn't written yet.</p>"
        : MD.render(md);

      renderEnd(mode);
      window.scrollTo(0, 0);
      page.classList.remove("fading");

      var j = page.querySelector(".juggle");
      if (j) startJuggle(j);
    });
  }

  function renderEnd(mode) {
    var bits = [];
    if (site && site.email) bits.push('<span><a href="mailto:' + site.email + '">Write to me</a></span>');
    (site && site.links || []).forEach(function (l) {
      bits.push('<span><a href="' + l.url + '" target="_blank" rel="noopener noreferrer">' + l.label + "</a></span>");
    });
    if (mode === "rabbit" && site && site.cv) bits.push('<span><a href="' + site.cv + '">CV (PDF)</a></span>');
    endEl.className = "end" + (site && site.placeholder ? " ph" : "");
    endEl.innerHTML = bits.join("");
    endEl.hidden = bits.length === 0;
  }

  /* ---------- the opening line: words arrive one by one, each struck through
     with a blue pen line, and only the last (Thinker) stays. Once per visit. ---------- */

  function startJuggle(slot) {
    if (get("sessionStorage", "juggled") === "1" || reduceMotion || current.mode !== "tortoise" || current.section !== "hi") return;
    set("sessionStorage", "juggled", "1");

    var words = Array.prototype.slice.call(slot.querySelectorAll(".w"));
    if (words.length < 2) return;
    var keep = words[words.length - 1];

    // measure while everything is in its resting state, then freeze the slot at the widest word
    var widest = 0;
    words.forEach(function (w) { widest = Math.max(widest, w.getBoundingClientRect().width); });
    var finalWidth = keep.getBoundingClientRect().width;
    slot.style.width = Math.ceil(widest) + "px";
    slot.classList.add("playing");
    words.forEach(function (w) { w.classList.remove("on", "struck"); });

    function alive() { return slot.isConnected; }

    function showAndStrike(w) {
      w.classList.add("on");
      return sleep(300).then(function () {
        if (!alive()) return;
        w.classList.add("struck");
        return sleep(420);
      }).then(function () {
        if (!alive()) return;
        w.classList.remove("on");
        return sleep(240);
      });
    }

    var chain = sleep(700);
    words.slice(0, -1).forEach(function (w) {
      chain = chain.then(function () { return alive() ? showAndStrike(w) : null; });
    });
    chain.then(function () {
      if (!alive()) return;
      keep.classList.add("on");
      slot.style.width = Math.ceil(finalWidth) + "px";
      return sleep(700);
    }).then(function () {
      if (!alive()) return;
      slot.classList.remove("playing");
      slot.style.width = "";
      words.forEach(function (w) { w.classList.remove("on", "struck"); });
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

  /* ---------- toggle + boot ---------- */

  function setMode(mode) {
    var r = parseHash();
    if (r.mode === mode) return;
    location.hash = hashFor(r.section, mode);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".switch .lab"), function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.mode); });
  });
  track.addEventListener("click", function () {
    setMode(parseHash().mode === "rabbit" ? "tortoise" : "rabbit");
  });

  buildTabs(DEFAULT_MODE);
  window.addEventListener("hashchange", route);
  route();
})();
