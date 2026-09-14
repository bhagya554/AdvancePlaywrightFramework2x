---
name: eli5-diagram
description: Explain a new or changed feature to a non-expert using big pictures and few words. Produces two artefacts — an ELI5 HTML explainer page and a matching editable .excalidraw diagram. Use when the user says /eli5-diagram, "explain this feature simply", "draw this for the team", "make an excalidraw of X", "diagram this flow", or asks for a picture explainer of code, config, a PR, or an architecture change.
---

# ELI5 Diagram

Turn one feature, flow, or gotcha into two things a teammate can open:

| Artefact | File | Who it is for |
| --- | --- | --- |
| ELI5 page | `docs/eli5/<slug>.html` | Anyone. Read-only, big pictures, few words. |
| Editable diagram | `docs/eli5/<slug>.excalidraw` | Whoever wants to redraw or extend it. |

Always produce **both**, unless the user asks for only one. They share a slug so they stay findable as a pair.

## Workflow

### 1. Find the truth first

Never diagram from the request alone. Read the real code before drawing.

- Feature named in a file/PR → read those files, plus what they import and who calls them.
- Feature named only in prose → `Grep` for the key identifier, read the top 2–3 hits.
- A gotcha or trap → find the exact line that causes it and record `file.ts:LINE`.

Write down, in one line each: **what goes in**, **what comes out**, **the 3–7 steps between**, **the one thing that surprises people**. That is the whole diagram. If a step does not change the input or the output, cut it.

### 2. Pick the shape

| Shape | Use when |
| --- | --- |
| **Pipeline** (left → right) | Data or control passes through stages. `spec → fixture → Page Object → Playwright`. |
| **Decision** (top → down, branches) | Precedence or fallback rules. `BASE_URL? → TTA_ENV? → default`. |
| **Before / After** (two stacks) | A change. Old on the left, new on the right, one arrow between. |
| **Layers** (stacked boxes) | Something wraps something else. |

One shape per diagram. If two shapes are needed, that is two diagrams.

### 3. Write the words

ELI5 means *few words*, not baby talk. Keep every technical term exact — `baseURL`, `devDependency`, `data-test` — and delete everything around it.

- Box label: **1–4 words.** `Read .env`, not `Reads the .env file from disk`.
- Arrow label: **0–3 words**, and only when the arrow is non-obvious.
- One caption sentence per box, max ~12 words, lives in the HTML page — not in the diagram.
- Never put a code block inside a box. Code goes in the HTML page, under the picture.
- Analogies allowed, but one per page and only if it survives scrutiny. A wrong analogy is worse than none.

### 4. Build the `.excalidraw`

Author a **scene spec** (small JSON), then generate the file — do not hand-write Excalidraw JSON.

```bash
node .claude/skills/eli5-diagram/scripts/make-excalidraw.mjs <spec.json> docs/eli5/<slug>.excalidraw
```

Minimal spec:

```json
{
  "title": "baseURL resolution",
  "direction": "right",
  "nodes": [
    { "id": "env",  "label": "BASE_URL\nset?",   "color": "yellow", "shape": "diamond" },
    { "id": "tta",  "label": "TTA_ENV\nlookup",  "color": "blue" },
    { "id": "hard", "label": "Hard-coded\ndefault", "color": "grey" }
  ],
  "edges": [
    { "from": "env", "to": "tta",  "label": "no" },
    { "from": "tta", "to": "hard", "label": "miss" }
  ],
  "notes": [
    { "text": "playwright.config.ts:6", "at": "env" }
  ]
}
```

Spec fields, layout rules, colours, and the raw Excalidraw element format are in
[reference/excalidraw-format.md](reference/excalidraw-format.md). Read it before writing a spec with
manual `x`/`y`, multiple rows, or anything the generator does not auto-place.

Keep the spec file next to the output as `docs/eli5/<slug>.spec.json` so the diagram can be
regenerated after edits.

Verify the output before claiming success:

```bash
node -e "const s=require('./docs/eli5/<slug>.excalidraw');console.log(s.type,s.elements.length)"
```

Expect `excalidraw` and a non-zero element count.

### 5. Build the HTML page

Start from [assets/eli5-template.html](assets/eli5-template.html). It is self-contained — no CDN, no
build step, opens with a double-click. Keep its structure:

1. **Title** — the feature, in plain words.
2. **One-line answer** — what this thing does, before any picture.
3. **The picture** — inline `<svg>`, drawn to match the `.excalidraw` scene.
4. **Step captions** — numbered, one sentence each, in the same order as the picture.
5. **The gotcha** — the surprising part, in its own callout, with a `file.ts:LINE` reference.
6. **Try it** — one command the reader can actually run.

Rules for the picture:

- Inline SVG only. No external images, no diagram libraries.
- `viewBox` set, `width="100%"`, `max-width` on the wrapper — it must survive a phone screen.
- Colours come from CSS custom properties so light and dark both work. Never hard-code `#fff`
  backgrounds behind text.
- Font size 16px minimum inside the SVG. If a label needs 12px to fit, the label is too long.
- Every arrow points one way and means one thing.

If the reader would have to zoom to read it, it failed.

### 6. Hand it over

Report the two paths, the one-line summary of what the diagram says, and the command to open it.
Offer to publish the HTML as an Artifact only if the user asks for a shareable link — load the
`artifact-design` skill first if so.

## Where files go

```
docs/eli5/
  <slug>.html          ELI5 page
  <slug>.excalidraw    editable diagram
  <slug>.spec.json     generator input, so the diagram can be rebuilt
```

Slug is kebab-case and describes the feature, not the ticket: `baseurl-resolution`, not `tta-412`.
Create `docs/eli5/` if it does not exist.

## Repo-specific notes

This repo (`AdvancedFramework_2x`) is a Playwright test framework. Good ELI5 subjects here, and where
the truth lives:

- baseURL / `TTA_ENV` precedence → `playwright.config.ts:6`, `.env.example`, `package.json` scripts.
- Layer flow → `src/fixtures/test-base.ts` → `src/pages/BasePage.ts` → `src/utils/UtilElementLocators.ts`.
- Step screenshots → `src/utils/visualStep.ts` and its index contract with `src/utils/CustomReporter.ts:298`.
- Credential name mismatch → `src/config/credentials.ts` vs `.env.example`.

`CLAUDE.md` already documents these traps in prose. The diagram's job is to make the trap
*visible*, not to restate the paragraph.

## Do not

- Do not draw a box for something you did not read.
- Do not invent a step to make the picture symmetric.
- Do not mix two features into one diagram.
- Do not hand-write `.excalidraw` JSON — the generator owns ids, seeds, and bindings.
- Do not ship the HTML without the `.excalidraw`, or the reader cannot correct you.
