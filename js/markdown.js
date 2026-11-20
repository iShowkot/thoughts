/*
 * A very small Markdown dialect, just enough for this site.
 *
 *   # Heading     ## Subheading     ---  (rule)
 *   blank line = new paragraph; a single newline inside a paragraph is kept as a line break (poems)
 *   - list item
 *   **bold**   *italic*
 *   [text](https://link)      a real link (solid underline)
 *   [text]{popover-key}       opens a card defined in content/popovers.json (dotted underline)
 *   {{juggle: A|B|C}}         the opening-line word shuffle; the last word is the one that stays
 *   [[placeholder]]           put at the end of a paragraph or list item to flag made-up text
 */
(function (root) {
  "use strict";

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function safeUrl(u) {
    return /^(https?:\/\/|mailto:|#|\/|\.{0,2}\/|[a-z0-9_\-]+(\/|\.))/i.test(u) && !/^\s*javascript:/i.test(u);
  }

  function inline(text) {
    var s = esc(text);

    s = s.replace(/\{\{juggle:\s*([^}]+?)\s*\}\}/g, function (_, list) {
      var words = list.split("|").map(function (w) { return w.trim(); }).filter(Boolean);
      var plain = words.join(", ");
      var spans = words.map(function (w, i) {
        var last = i === words.length - 1;
        return '<span class="w' + (last ? " stay" : "") + '" data-i="' + i + '">' + w + "</span>";
      }).join("");
      return '<span class="sr-only">' + plain + '</span><span class="juggle" aria-hidden="true">' + spans + "</span>";
    });

    s = s.replace(/\[([^\]]+)\]\{([a-z0-9-]+)\}/g, function (_, label, key) {
      return '<button type="button" class="pop" data-pop="' + key + '" aria-haspopup="dialog" aria-expanded="false">' + label + "</button>";
    });

    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      var raw = url.replace(/&amp;/g, "&");
      if (!safeUrl(raw)) return label;
      var ext = /^https?:\/\//i.test(raw);
      return '<a href="' + esc(raw) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + label + "</a>";
    });

    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return s;
  }

  var PH = /\s*\[\[placeholder\]\]\s*$/;

  function render(src) {
    var blocks = src.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").trim().split(/\n{2,}/);
    var out = [];

    blocks.forEach(function (block) {
      block = block.replace(/^\n+|\n+$/g, "");
      if (!block) return;
      var m;

      if (/^---+$/.test(block)) { out.push("<hr>"); return; }

      if ((m = block.match(/^(#{1,2})\s+(.*)$/))) {
        var ph = PH.test(m[2]);
        var tag = "h" + m[1].length;
        out.push("<" + tag + (ph ? ' class="ph"' : "") + ">" + inline(m[2].replace(PH, "")) + "</" + tag + ">");
        return;
      }

      if (/^- /.test(block)) {
        var items = block.split(/\n(?=- )/).map(function (li) {
          var t = li.replace(/^- /, "").replace(/\n/g, " ");
          var p = PH.test(t);
          return "<li" + (p ? ' class="ph"' : "") + ">" + inline(t.replace(PH, "")) + "</li>";
        });
        out.push("<ul>" + items.join("") + "</ul>");
        return;
      }

      var isPh = PH.test(block);
      var body = block.replace(PH, "").split("\n").map(inline).join("<br>\n");
      out.push("<p" + (isPh ? ' class="ph"' : "") + ">" + body + "</p>");
    });

    return out.join("\n");
  }

  var api = { render: render, inline: inline };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MD = api;
})(typeof window !== "undefined" ? window : this);
