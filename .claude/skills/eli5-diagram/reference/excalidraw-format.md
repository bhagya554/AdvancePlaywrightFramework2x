# Reference — scene spec and Excalidraw file format

Two formats matter here. The **scene spec** is what you write. The **Excalidraw file** is what
`scripts/make-excalidraw.mjs` emits. Write the first; read the second only when debugging.

---

## 1. Scene spec

```json
{
  "title": "baseURL resolution",
  "direction": "right",
  "background": "#ffffff",

  "nodeWidth": 200,
  "nodeHeight": 100,
  "gapX": 120,
  "gapY": 90,
  "originX": 120,
  "originY": 160,
  "fontSize": 20,
  "noteFontSize": 14,

  "nodes": [],
  "edges": [],
  "notes": []
}
```

Every field outside `nodes` is optional. The defaults produce a readable diagram; change them only
when boxes collide or labels overflow.

### `nodes[]`

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Spec-local name. Edges and notes reference it. Not written to the file. |
| `label` | yes | Box text. `\n` for line breaks. 1–4 words per line. |
| `color` | no | `blue` `green` `yellow` `red` `purple` `orange` `grey` `plain`. Default `blue`. |
| `shape` | no | `rectangle` (default), `diamond` for decisions, `ellipse` for start/end. |
| `width` / `height` | no | Override the box size. Grow the box before shrinking the font. |
| `x` / `y` | no | Pin the box. Skips auto-layout for this node only. |
| `row` | no | With `direction: "right"` — which horizontal lane. `0` is the main line, `1` sits below. |
| `col` | no | With `direction: "down"` — which vertical lane. |
| `fontSize` | no | Per-node override. |

Auto-layout walks nodes in array order along the main axis, one step per node, whether or not they
share a lane. To place a branch beside an existing box rather than after it, pin it with `x`/`y`.

### `edges[]`

| Field | Required | Meaning |
| --- | --- | --- |
| `from` / `to` | yes | Node `id`s. |
| `label` | no | 0–3 words. Rendered small, bound to the arrow. |
| `sides` | no | `["right","left"]` to force anchors. Default is chosen from relative position. |
| `color` | no | Palette name. Default black. |
| `emphasis` | no | `true` thickens the stroke — use for the one path that matters. |
| `bidirectional` | no | `true` adds a head at both ends. |

Arrows are bound to both boxes, so dragging a box in Excalidraw re-routes the arrow. Do not draw an
arrow between boxes that are not adjacent in the story — a skipped step is a missing box.

### `notes[]`

| Field | Meaning |
| --- | --- |
| `text` | Free text. Use for file references: `playwright.config.ts:6`. |
| `at` | Node `id` — pins the note centred under that node. |
| `x` / `y` | Absolute placement, when `at` is not used. |
| `color` | Palette name. Default grey. |

Notes are unbound text. They carry the `file.ts:LINE` evidence that keeps the diagram honest.

### Run it

```bash
node .claude/skills/eli5-diagram/scripts/make-excalidraw.mjs docs/eli5/<slug>.spec.json docs/eli5/<slug>.excalidraw
```

Prints the element and shape count. A count of 0 shapes means the spec had no `nodes`.

---

## 2. Excalidraw file format

Only needed when hand-checking output or importing a scene someone else drew.

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "eli5-diagram skill",
  "elements": [],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

Every element shares this envelope:

```json
{
  "id": "unique-string",
  "type": "rectangle | diamond | ellipse | arrow | line | text | freedraw",
  "x": 0, "y": 0, "width": 0, "height": 0, "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid | hachure | cross-hatch",
  "strokeWidth": 2,
  "strokeStyle": "solid | dashed | dotted",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "roundness": { "type": 3 },
  "seed": 1, "version": 1, "versionNonce": 1,
  "isDeleted": false,
  "boundElements": null,
  "updated": 1,
  "link": null,
  "locked": false
}
```

Things that break scenes if you get them wrong:

- **`roundness`** — `{ "type": 3 }` for rounded rectangles, `{ "type": 2 }` for curved arrows,
  `null` for text, diamonds and ellipses.
- **Bound text** — a label inside a box is a *separate* `text` element with
  `containerId: "<box id>"`, and the box must list it back in
  `boundElements: [{ "id": "<text id>", "type": "text" }]`. One direction alone silently drops it.
- **Arrows** — `points` is relative to the arrow's own `x`/`y` and must start at `[0,0]`.
  `startBinding` / `endBinding` are `{ elementId, focus, gap }`; `focus: 0` aims at the box centre.
  Without bindings the arrow does not follow a dragged box.
- **Text metrics** — `width`/`height` must roughly match the string, or Excalidraw renders clipped
  text until the element is edited. `lineHeight: 1.25`, `fontFamily: 1` (hand-drawn).
- **`isDeleted: true`** elements still load and still count. Never emit them.

Coordinates are unbounded and origin-free; the canvas scrolls to content on open.

---

## 3. Opening the result

| Where | How |
| --- | --- |
| VS Code | Excalidraw extension (`pomdtr.excalidraw-editor`) — opens `.excalidraw` natively. |
| Browser | <https://excalidraw.com> → **Open** → pick the file. |
| Export | In Excalidraw: **Export image** → SVG → paste inline into the ELI5 HTML page. |

The `.excalidraw` file is plain JSON and diffs badly. Regenerate from the spec rather than merging
two edited scenes.
