# thoughts

Showkot Shawon's portfolio. A reading site: text on paper, with two ways to read it.

- **Tortoise** (default): the stories. Unfinished.
- **Rabbit**: direct facts only.

No framework, no build step. Plain HTML, CSS and a little JavaScript. Hosted on GitHub Pages.

## Editing

Everything you write lives in `content/`, one Markdown file per section per mode:

```
content/education.tortoise.md   the story
content/education.rabbit.md     the facts
```

Sections: `hi`, `education`, `designs`, `poetry`, `artworks`, `infinity`.

### Writing syntax

| You write | You get |
|---|---|
| `# Title` | heading |
| blank line | new paragraph |
| a plain line break | a line break (good for poems) |
| `- item` | list item |
| `[text](https://example.com)` | a real link (solid underline) |
| `[text]{key}` | a popover card (dotted underline), defined in `content/popovers.json` |
| `**bold**` `*italic*` | bold, italic |
| `{{juggle: A\|B\|C}}` | the opening line: words arrive one by one, each struck through with a blue pen line; the last word is the one that stays |
| `[[placeholder]]` at the end of a paragraph or list item | flags it as made-up text |

### Popovers

`content/popovers.json` holds the cards. Each has `title`, `text`, and optionally `image`, `alt` and `link` (`{ "label": "...", "url": "..." }`). Put image files in an `images/` folder.

### Contact, links, CV

`content/site.json` controls the quiet line at the very end of each page: `email`, `links`, and `cv` (a path like `cv.pdf`; shown in Rabbit only; leave `""` for none).

## Finding what is still made up

Every piece of dummy text ends with `[[placeholder]]`. To list them all:

```
grep -rn "placeholder" content/
```

To see them highlighted in the browser, add `?dev` to the address (for example `http://localhost:8000/?dev`). On localhost it is on automatically. Readers never see the highlight.

Before publishing, check these in particular:
- `content/site.json`: the email is a placeholder (`hello@example.com`), `placeholder` should be set to `false` once it's real.
- Popover cards for Kirki, Kirki eCommerce, EasyStore, GrowFund and the sample artwork are flagged.
- Poetry has no real poems yet, only structural placeholders.

## Preview locally

```
python3 -m http.server 8000
```

then open http://localhost:8000/ (the site loads its pages with `fetch`, so opening the file directly won't work).

## Publishing

GitHub repo, Settings, Pages: deploy from the `main` branch, root folder. The site will be at `https://ishowkot.github.io/thoughts/`. All paths are relative, so a custom domain can be added later without changing any code.

## Layout

On wide screens a quiet tab strip sits at the top and scrolls away with the page. On phones there is no top strip: the tabs sit at the end of each page. The Tortoise / Rabbit switch is always at the end of the page. Contact and links are the last, smallest line.

## Addresses

Pages are addressed `#section-mode`, for example `/#education-rabbit` (the older `#education/rabbit` still works), so you can share the Rabbit view of any page directly.

## Fonts

Source Serif 4, self-hosted (SIL Open Font License, see `fonts/LICENSE.txt`).
