# The Leonida Field Guide — GTA VI Trophy Guide & Tracker

[![Rank](https://make.fun/badge/gta6-trophy-guide-01/androyesfernandez/gta6-trophy-guide-v3/rank.svg)](https://make.fun/competitions/gta6-trophy-guide-01)
[![Reward](https://make.fun/badge/gta6-trophy-guide-01/androyesfernandez/gta6-trophy-guide-v3/reward.svg)](https://make.fun/competitions/gta6-trophy-guide-01)
[![make.fun](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/competitions/gta6-trophy-guide-01)

An unofficial, fully offline trophy guide and tracker for **Grand Theft Auto VI**
(PlayStation 5), built for the make.fun `gta6-trophy-guide-01` competition.

## What it is

A dark, game-authentic tracker for all **55 official trophies** that treats
citations as a first-class feature:

- **Numbered, cited steps for every trophy** — each step carries the numbers of
  the sources in `app/data/sources.json` that back it.
- **A computed audit strip** — every headline count (claims cited, claims backed
  by 2+ sources, sources, sites, disputes, watch windows) is calculated in the
  browser from the data files by `computeAudit()`. Nothing is hard-coded, so the
  strip cannot over-claim the data.
- **Disputes shown both ways** — where sources disagree (the meditation count,
  the possibly-missable balcony spot, vehicle totals…), the guide pane shows
  side A, side B and our verdict.
- **PSN points layer** — points by grade (bronze 15 · silver 30 · gold 90 ·
  platinum 300, totalling 1,350 for the list) in the header, per trophy, and in
  per-stage subtotals on the cover's S1–S7 stage strip.
- **Route order** — every trophy carries a recommended earn order (1–55) across
  the 7-stage roadmap; the checklist sorts by it and the Next-up planner follows
  it.
- **Missables done properly** — one possibly missable trophy plus a windowed
  watch list, drawn as a timeline grid with last-chance cells, story gates and a
  manual-save protocol.
- **A Road to 100% view** — the big completion rows (277 vehicles, 255 animals,
  80 challenges, 300 stunts, 18 meditation spots…) as tickable, cited counters.
- **Interactive PSN counters** with tick grids, per-trophy notes, spoiler
  shield for hidden trophies, search/filters/sort, and export/import/reset —
  all stored only in your browser's localStorage.

## Run it

```sh
node serve.ts          # serves app/ at http://localhost:8080
# or open app/index.html through any static file server
```

No build step, no network calls: plain HTML/CSS/JS plus JSON data files.

## Layout

- `app/index.html`, `app/style.css`, `app/app.js` — the tracker (hash-routed
  views: Tracker · Roadmap · Missables · Sources · 100% · Next up)
- `app/data/trophies.json` — the 55 trophies with guides, steps, tips,
  disputes, missable windows, difficulty, time, stage and route
- `app/data/sources.json` — the numbered source registry (read dates and
  honest depth tags included)
- `app/data/roadmap.json` — the 7-stage roadmap: cited actions and facts
- `app/data/completion.json` — the Road to 100% rows
- `main.ts` — the competition entrypoint; copies `app/` and `screenshots/`
  to the output directory and writes the dossier with the vendored library
- `shots.json` — which views the screenshots show

Guide text is original writing; factual claims are credited to the numbered
sources everywhere they are used. This is a fan work and is not affiliated
with Rockstar Games or Take-Two Interactive.
