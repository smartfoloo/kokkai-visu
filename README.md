# 国会ボード

A Kanban-style board that shows what's moving through the Japanese Diet (国会) **right
now**. Columns are legislative stages (提出 → 委員会審議 → 本会議 → 参議院 → 成立・廃案);
each card is a bill colored by submitting party, tagged by policy category, and tinted
when it has been stuck in a stage unusually long. Click a card for a plain-language
summary, the party vote breakdown, a stage-by-stage timeline, and official links.

You land directly in the board — no homepage. Filters (会派 / 分野 / 段階 / 検索) live in
the top bar and in the URL, so any filtered view is shareable.

## Data

All bill data comes from the **SmartNews Media Research Institute** datasets, which are
scraped daily from the official shugiin.go.jp / sangiin.go.jp sites and published as
MIT-licensed CSV/JSON:

- House of Representatives — https://github.com/smartnews-smri/house-of-representatives
- House of Councillors — https://github.com/smartnews-smri/house-of-councillors

The House of Representatives dataset is the spine (deliberation status, era-formatted
stage dates, faction for/against votes); the House of Councillors dataset enriches each
bill with the sangiin outline URL and numeric roll-call tallies.

### AI explanations (Gemini, grounded)

Each bill gets a beginner-friendly explanation in the みらい議会 style: an easy-to-understand
**title rewrite**, a one-line summary, and **headed sections with bullets**. These are generated
by **Google Gemini** (`gemini-3-flash`) **with Google Search grounding**, primed with the official
議案要旨 (`scripts/youshi.ts`) so it stays faithful and can also cover bills that have no published
要旨. The model returns a small Markdown contract (`TITLE` / `SUMMARY` / `## sections` / `- bullets`)
which `scripts/aimd.ts` parses into structure; grounding sources are captured and shown as 参考.
Everything is cached in `data/ai.json`, keyed by an input hash + prompt version, so each bill is
generated once. `build-data` only trusts a cached entry whose hash matches the current input.

## Pipeline

```
SMRI CSVs ─► scripts/build-data.ts ─► static/{bills,meta}.json
                                       ▲
scripts/fetch-content.ts ─► data/content/<id>.txt
scripts/summarize.ts (Gemini + grounding) ─► data/ai.json
```

| Command | What it does |
|---------|--------------|
| `npm run data` | Fetch SMRI CSVs, normalize, merge both houses, classify category, compute stage/heat, parse the official 要旨, fold in cached AI explanations → `static/bills.json` + `static/meta.json`. |
| `npm run data:content` | Fetch each bill's official outline text (cached per bill in `data/content/`). |
| `npm run data:summaries` | Generate beginner-friendly grounded explanations (title + summary + sections) via Gemini, cached in `data/ai.json` (keyed by input hash + prompt version). Skips silently without `GEMINI_API_KEY`. Get a free key at https://aistudio.google.com/apikey. |
| `npm run data:all` | All of the above, then re-run `data` to fold the AI explanations in. |

`SESSION=<n>` selects a Diet session (defaults to the latest in the data, currently 221).

## Develop

```bash
npm install
npm run data        # generate static/bills.json (first run only; committed copy exists)
npm run dev         # http://localhost:5173
npm test            # unit tests (date parser, category classifier)
```

### AI explanations (optional)

Get a free key at https://aistudio.google.com/apikey, then:

```bash
echo "GEMINI_API_KEY=..." >> .env   # auto-loaded by the scripts
npm run data:content && npm run data:summaries && npm run data
```

Gemini's free tier is generous (~1,500 req/day, 1M TPM), so a full session is well within
limits. Each bill is generated once and cached in `data/ai.json` (keyed by input hash +
prompt version); `build-data` only trusts a cached entry whose hash matches the current
input, so stale explanations never reach the UI. Without a key the build still succeeds and
explanations are simply absent (the official 要旨 preview is used as a fallback blurb).

> Model note: use **Gemini 3 Flash** (text), not "Flash **Live**" (that's the realtime-audio
> model). Override the exact id with `GEMINI_MODEL` if AI Studio lists a different string.

## Deploy

`adapter-static` builds a static site. `.github/workflows/daily-build.yml` rebuilds the
data daily (after the SMRI refresh), regenerates explanations for any new bills, commits the
caches back, and deploys to **GitHub Pages**. Add a `GEMINI_API_KEY` repository secret to
enable explanations in CI. To deploy on a project page, the workflow passes `BASE_PATH`
automatically.

## Stack

SvelteKit (Svelte 5 runes) · Vite · Tailwind CSS · TypeScript. Design language follows
[Chakra UI v3](https://chakra-ui.com/) — its zinc gray scale, teal brand accent, semantic
`bg`/`fg`/`border` tokens (light + dark), and card radii/shadows are reproduced as Tailwind
tokens in `src/app.css`. Bill details open in an almost-fullscreen dialog with a tabbed
layout (概要 / なぜ重要か / 変わること / 採決 / 経過 / 公式情報).
