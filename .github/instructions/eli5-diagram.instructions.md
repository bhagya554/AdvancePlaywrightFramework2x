---
applyTo: "docs/eli5/**,**/*.excalidraw"
description: Rules that apply whenever an ELI5 explainer page or an Excalidraw diagram is edited.
---

# Editing ELI5 explainers and Excalidraw diagrams

These files come in threes and must stay in sync:

```
docs/eli5/<slug>.spec.json     generator input  (edit this)
docs/eli5/<slug>.excalidraw    generated        (regenerate, never hand-edit)
docs/eli5/<slug>.html          explainer page   (edit by hand)
```

To create a new set, run the `/eli5-diagram` prompt rather than starting from scratch.

## `.spec.json`

The hand-authored source. After changing it, regenerate:

```bash
node .claude/skills/eli5-diagram/scripts/make-excalidraw.mjs docs/eli5/<slug>.spec.json docs/eli5/<slug>.excalidraw
```

Field reference: `.claude/skills/eli5-diagram/reference/excalidraw-format.md`.

## `.excalidraw`

Generated JSON. Do not hand-edit it in a text editor — change the spec and regenerate, or open it in
Excalidraw and edit visually. If it was edited visually and the spec no longer matches, update the
spec to agree before touching either again; the two silently diverging is the main failure mode here.

Hand-written Excalidraw JSON breaks in predictable ways:

- A label inside a box is a separate `text` element with `containerId` pointing at the box, **and**
  the box must list it back in `boundElements`. One direction alone drops the label.
- Arrow `points` are relative to the arrow's own `x`/`y` and must start at `[0,0]`.
- `startBinding` / `endBinding` are what make an arrow follow a dragged box.
- `roundness` is `{"type":3}` for rounded rectangles, `{"type":2}` for arrows, `null` for text.

The file diffs badly. Regenerate rather than merging two edited scenes.

## `.html`

Self-contained: inline SVG, inline CSS, no CDN, no build step, opens with a double-click. Keep it
that way.

- Colours come from the CSS custom properties at the top of the file, so light and dark both work.
  Never hard-code a background behind text.
- SVG text is 16px minimum. A label that needs 12px to fit is too long — shorten the words or widen
  the box.
- Box labels 1–4 words, arrow labels 0–3 words. Sentences go in the step captions below the picture,
  not inside the diagram.
- Every gotcha cites a real `path/to/file.ts:LINE`.
- Keep the SVG and the `.excalidraw` scene telling the same story. Changing one means changing both.
