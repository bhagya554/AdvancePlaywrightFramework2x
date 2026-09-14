---
mode: agent
description: Explain a feature with big pictures and few words — produces an ELI5 HTML page plus a matching editable .excalidraw diagram.
tools: ['codebase', 'search', 'editFiles', 'runCommands', 'changes']
---

# ELI5 Diagram

Explain `${input:feature:Which feature, flow, file or PR should I explain?}` to someone who knows
nothing about it, using big pictures and few words.

Produce **two** files that share a slug, so they stay findable as a pair:

| File | Purpose |
| --- | --- |
| `docs/eli5/<slug>.html` | Read-only explainer. Opens with a double-click. |
| `docs/eli5/<slug>.excalidraw` | Editable diagram — anyone can redraw it. |
| `docs/eli5/<slug>.spec.json` | Generator input, so the diagram can be rebuilt. |

Slug is kebab-case and names the feature, not the ticket: `baseurl-resolution`, not `tta-412`.

---

## 1. Read the truth first

Never diagram from the request alone.

- File or PR named → read those files, what they import, and who calls them.
- Prose only → search the codebase for the key identifier, read the top hits.
- A trap or gotcha → find the exact line and record it as `path/to/file.ts:LINE`.

Then write one line each for: **what goes in**, **what comes out**, **the 3–7 steps between**,
**the one thing that surprises people**. That is the whole diagram. A step that changes neither the
input nor the output gets cut.

## 2. Pick one shape

- **Pipeline** (left → right) — data passes through stages.
- **Decision** (top → down with branches) — precedence or fallback rules.
- **Before / After** (two stacks) — a change, old left, new right.
- **Layers** (stacked boxes) — one thing wraps another.

One shape per diagram. Two shapes means two diagrams. Never mix two features into one picture.

## 3. Write the words

ELI5 means *few words*, not baby talk. Technical terms stay exact; everything around them goes.

- Box label: 1–4 words. `Read .env`, not `Reads the .env file from disk`.
- Arrow label: 0–3 words, and only when the arrow is non-obvious.
- Captions live in the HTML, not in the picture. Max ~12 words each.
- Never put a code block inside a box.
- One analogy per page, or none. A wrong analogy is worse than no analogy.

## 4. Generate the `.excalidraw`

Write a scene spec, then run the generator. **Do not hand-write Excalidraw JSON** — the generator
owns ids, seeds, text centring and arrow bindings, and getting those wrong produces a scene that
loads with clipped text and detached arrows.

```bash
node .claude/skills/eli5-diagram/scripts/make-excalidraw.mjs docs/eli5/<slug>.spec.json docs/eli5/<slug>.excalidraw
```

Spec shape:

```json
{
  "title": "baseURL resolution",
  "direction": "right",
  "nodes": [
    { "id": "env",  "label": "BASE_URL\nset?",      "color": "yellow", "shape": "diamond" },
    { "id": "tta",  "label": "TTA_ENV\nlookup",     "color": "blue" },
    { "id": "hard", "label": "Hard-coded\ndefault", "color": "grey", "row": 1 }
  ],
  "edges": [
    { "from": "env", "to": "tta",  "label": "no" },
    { "from": "tta", "to": "hard", "label": "miss", "emphasis": true }
  ],
  "notes": [
    { "text": "playwright.config.ts:6", "at": "env" }
  ]
}
```

- `color`: `blue` `green` `yellow` `red` `purple` `orange` `grey` `plain`.
- `shape`: `rectangle` (default), `diamond` for decisions, `ellipse` for start/end.
- `row` / `col`: branch lane off the main line. `x`/`y` pin a box exactly.
- Full field reference: `.claude/skills/eli5-diagram/reference/excalidraw-format.md`.

Verify before reporting success — expect `excalidraw` and a non-zero count:

```bash
node -e "const s=require('./docs/eli5/<slug>.excalidraw');console.log(s.type,s.elements.length)"
```

## 5. Build the HTML page

Copy `.claude/skills/eli5-diagram/assets/eli5-template.html` and fill it in. Keep its structure:

1. Title in plain words.
2. One-line answer, before any picture.
3. The picture — inline `<svg>` matching the `.excalidraw` scene.
4. Numbered step captions, same order as the picture.
5. The gotcha, in its own callout, with a `file.ts:LINE` reference.
6. One command the reader can actually run.

Picture rules: inline SVG only, no CDN and no diagram library; `viewBox` set and width 100%; colours
from the template's CSS custom properties so light and dark both work; 16px minimum text. If a label
needs 12px to fit, the label is too long. If the reader has to zoom, it failed.

## 6. Report

Give the file paths, one line on what the diagram says, and how to open it (VS Code Excalidraw
extension, or excalidraw.com → Open).

---

## Repo context

`AdvancedFramework_2x` is a Playwright TypeScript UI + API test framework. Test-only — everything is
a `devDependency`. Good ELI5 subjects and where their truth lives:

- baseURL / `TTA_ENV` precedence → `playwright.config.ts:6`, `.env.example`, `package.json` scripts.
- Layer flow → `src/fixtures/test-base.ts` → `src/pages/BasePage.ts` → `src/utils/UtilElementLocators.ts`.
- Step screenshots → `src/utils/visualStep.ts` and its index contract with `src/utils/CustomReporter.ts:298`.
- Credential name mismatch → `src/config/credentials.ts` vs `.env.example`.

`CLAUDE.md` documents these traps in prose. The diagram's job is to make the trap **visible**, not to
restate the paragraph.

## Do not

- Draw a box for something you did not read.
- Invent a step to make the picture symmetric.
- Hand-write `.excalidraw` JSON.
- Ship the HTML without the `.excalidraw` — the reader cannot correct a picture they cannot edit.
