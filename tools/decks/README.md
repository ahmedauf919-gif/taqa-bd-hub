# PowerPoint exports

Generators for the two downloadable decks served from `presentations/`:

| Deck | Script | Output |
|---|---|---|
| Intro — "One Company, Every Utility" | `intro.js` | `presentations/intro-briefing.pptx` |
| Portfolio Analytics Briefing | `briefing.js` | `presentations/portfolio-analytics-briefing.pptx` |

Both use one theme and three layouts (Cover / Dark / Light) from `common.js`, so a colour or
font change is made once. Everything is native and editable: text, shapes, the sector bar
charts and the sector × service table. Only the two dot-matrix pictures (`make-dots.py`) are images.

The briefing's maps are redrawn as an Egypt outline (`egypt.json`, Natural Earth) with one bubble
per governorate, because the website's satellite tiles cannot be embedded in a file. Governorate
counts are read from `globe/data.js`, which is built from the same portfolio data as the dashboard.

```
npm i pptxgenjs                       # once, outside the repo or here
node intro.js    ../../presentations/intro-briefing.pptx
node briefing.js ../../presentations/portfolio-analytics-briefing.pptx
```

`common.js` also needs the `apply_theme.js` helper from the pptx skill (set `PPTX_SKILL_DIR`),
which writes the theme colours into the saved file.

If the website decks change, update the matching text in these scripts and regenerate.
