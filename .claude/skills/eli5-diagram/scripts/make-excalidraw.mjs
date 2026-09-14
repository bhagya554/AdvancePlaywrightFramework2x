#!/usr/bin/env node
/**
 * Scene spec -> .excalidraw file.
 *
 *   node make-excalidraw.mjs <spec.json> <out.excalidraw>
 *
 * The spec is the small, hand-authored part. This script owns everything
 * Excalidraw needs but nobody wants to write: ids, seeds, nonces, text
 * centring, arrow geometry and start/end bindings.
 *
 * See ../reference/excalidraw-format.md for the full spec reference.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PALETTE = {
  blue:   { bg: '#a5d8ff', stroke: '#1971c2' },
  green:  { bg: '#b2f2bb', stroke: '#2f9e44' },
  yellow: { bg: '#ffec99', stroke: '#f08c00' },
  red:    { bg: '#ffc9c9', stroke: '#e03131' },
  purple: { bg: '#d0bfff', stroke: '#6741d9' },
  orange: { bg: '#ffd8a8', stroke: '#e8590c' },
  grey:   { bg: '#e9ecef', stroke: '#495057' },
  plain:  { bg: 'transparent', stroke: '#1e1e1e' },
};

const DEFAULTS = {
  nodeWidth: 200,
  nodeHeight: 100,
  gapX: 120,
  gapY: 90,
  originX: 120,
  originY: 160,
  fontSize: 20,
  titleFontSize: 28,
  noteFontSize: 14,
};

const LINE_HEIGHT = 1.25;
// Virgil (fontFamily 1) is close enough to 0.55em average advance for layout maths.
const CHAR_W = 0.55;

let seq = 0;
const nextId = (prefix) => `${prefix}-${(++seq).toString(36)}-eli5`;
const nonce = () => 1000 + seq * 7;

const textWidth = (text, fontSize) =>
  Math.max(...text.split('\n').map((l) => l.length)) * fontSize * CHAR_W;
const textHeight = (text, fontSize) => text.split('\n').length * fontSize * LINE_HEIGHT;

function baseElement(type, props) {
  return {
    id: props.id,
    type,
    x: props.x,
    y: props.y,
    width: props.width,
    height: props.height,
    angle: 0,
    strokeColor: props.strokeColor ?? '#1e1e1e',
    backgroundColor: props.backgroundColor ?? 'transparent',
    fillStyle: 'solid',
    strokeWidth: props.strokeWidth ?? 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: props.groupIds ?? [],
    frameId: null,
    roundness: props.roundness ?? null,
    seed: nonce(),
    version: 1,
    versionNonce: nonce(),
    isDeleted: false,
    boundElements: props.boundElements ?? null,
    updated: 1,
    link: null,
    locked: false,
  };
}

function textElement({ id, text, x, y, fontSize, containerId, align = 'center', color }) {
  return {
    ...baseElement('text', {
      id,
      x,
      y,
      width: textWidth(text, fontSize),
      height: textHeight(text, fontSize),
      strokeColor: color ?? '#1e1e1e',
    }),
    fontSize,
    fontFamily: 1,
    text,
    textAlign: containerId ? 'center' : align,
    verticalAlign: containerId ? 'middle' : 'top',
    containerId: containerId ?? null,
    originalText: text,
    lineHeight: LINE_HEIGHT,
    autoResize: true,
  };
}

/**
 * Place nodes the caller did not pin with explicit x/y.
 * `direction: "right"` walks columns; `"down"` walks rows. A node may set
 * `row` (for direction right) or `col` (for direction down) to branch off the
 * main line — that is how decision diagrams get their "no" branch.
 */
function layout(nodes, spec) {
  const dir = spec.direction ?? 'right';
  const gapX = spec.gapX ?? DEFAULTS.gapX;
  const gapY = spec.gapY ?? DEFAULTS.gapY;
  const ox = spec.originX ?? DEFAULTS.originX;
  const oy = spec.originY ?? DEFAULTS.originY;

  let main = 0;
  for (const n of nodes) {
    if (n.x !== undefined && n.y !== undefined) continue;
    const lane = dir === 'right' ? (n.row ?? 0) : (n.col ?? 0);
    if (dir === 'right') {
      n.x = ox + main * (n.width + gapX);
      n.y = oy + lane * (n.height + gapY);
    } else {
      n.x = ox + lane * (n.width + gapX);
      n.y = oy + main * (n.height + gapY);
    }
    main += 1;
  }
}

/** Anchor points on a node's bounding box. */
const side = (n) => ({
  right: [n.x + n.width, n.y + n.height / 2],
  left: [n.x, n.y + n.height / 2],
  top: [n.x + n.width / 2, n.y],
  bottom: [n.x + n.width / 2, n.y + n.height],
  center: [n.x + n.width / 2, n.y + n.height / 2],
});

/** Choose which sides an arrow leaves from and lands on, from relative position. */
function anchors(from, to) {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  }
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

function build(spec) {
  const elements = [];
  const byId = new Map();

  const nodes = (spec.nodes ?? []).map((n) => ({
    ...n,
    width: n.width ?? spec.nodeWidth ?? DEFAULTS.nodeWidth,
    height: n.height ?? spec.nodeHeight ?? DEFAULTS.nodeHeight,
    excalidrawId: nextId('node'),
  }));
  layout(nodes, spec);
  nodes.forEach((n) => byId.set(n.id, n));

  // Title, centred over the drawn area.
  if (spec.title) {
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const minY = Math.min(...nodes.map((n) => n.y));
    const fs = spec.titleFontSize ?? DEFAULTS.titleFontSize;
    const w = textWidth(spec.title, fs);
    elements.push(
      textElement({
        id: nextId('title'),
        text: spec.title,
        x: (minX + maxX) / 2 - w / 2,
        y: minY - fs * 2.6,
        fontSize: fs,
      }),
    );
  }

  // Nodes, each with its label bound inside so dragging the box moves the text.
  for (const n of nodes) {
    const colour = PALETTE[n.color ?? 'blue'] ?? PALETTE.blue;
    const shape = n.shape ?? 'rectangle';
    const labelId = nextId('label');
    const fontSize = n.fontSize ?? spec.fontSize ?? DEFAULTS.fontSize;

    elements.push({
      ...baseElement(shape === 'diamond' ? 'diamond' : shape === 'ellipse' ? 'ellipse' : 'rectangle', {
        id: n.excalidrawId,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        backgroundColor: colour.bg,
        strokeColor: colour.stroke,
        roundness: shape === 'rectangle' ? { type: 3 } : null,
        boundElements: [{ id: labelId, type: 'text' }],
      }),
    });

    const th = textHeight(n.label ?? '', fontSize);
    elements.push(
      textElement({
        id: labelId,
        text: n.label ?? '',
        x: n.x + n.width / 2 - textWidth(n.label ?? '', fontSize) / 2,
        y: n.y + n.height / 2 - th / 2,
        fontSize,
        containerId: n.excalidrawId,
        color: '#1e1e1e',
      }),
    );
  }

  // Edges. Bindings let Excalidraw re-route the arrow when a box is dragged.
  for (const e of spec.edges ?? []) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) throw new Error(`edge references unknown node: ${e.from} -> ${e.to}`);

    const [fromSide, toSide] = e.sides ?? anchors(from, to);
    const [sx, sy] = side(from)[fromSide];
    const [ex, ey] = side(to)[toSide];
    const arrowId = nextId('arrow');
    const bound = [];

    if (e.label) {
      const labelId = nextId('edgelabel');
      const fs = spec.noteFontSize ?? DEFAULTS.noteFontSize;
      bound.push({ id: labelId, type: 'text' });
      elements.push(
        textElement({
          id: labelId,
          text: e.label,
          x: (sx + ex) / 2 - textWidth(e.label, fs) / 2,
          y: (sy + ey) / 2 - textHeight(e.label, fs) / 2,
          fontSize: fs,
          containerId: arrowId,
          color: '#495057',
        }),
      );
    }

    elements.push({
      ...baseElement('arrow', {
        id: arrowId,
        x: sx,
        y: sy,
        width: Math.abs(ex - sx),
        height: Math.abs(ey - sy),
        strokeColor: e.color ? (PALETTE[e.color]?.stroke ?? '#1e1e1e') : '#1e1e1e',
        strokeWidth: e.emphasis ? 4 : 2,
        roundness: { type: 2 },
        boundElements: bound.length ? bound : null,
      }),
      points: [
        [0, 0],
        [ex - sx, ey - sy],
      ],
      lastCommittedPoint: null,
      startBinding: { elementId: from.excalidrawId, focus: 0, gap: 6 },
      endBinding: { elementId: to.excalidrawId, focus: 0, gap: 6 },
      startArrowhead: e.bidirectional ? 'arrow' : null,
      endArrowhead: 'arrow',
      elbowed: false,
    });
  }

  // Free notes. `at: "<nodeId>"` pins the note under that node; otherwise x/y.
  for (const note of spec.notes ?? []) {
    const fs = note.fontSize ?? spec.noteFontSize ?? DEFAULTS.noteFontSize;
    let x = note.x;
    let y = note.y;
    if (note.at) {
      const n = byId.get(note.at);
      if (!n) throw new Error(`note references unknown node: ${note.at}`);
      x = n.x + n.width / 2 - textWidth(note.text, fs) / 2;
      y = n.y + n.height + 12;
    }
    elements.push(
      textElement({
        id: nextId('note'),
        text: note.text,
        x: x ?? DEFAULTS.originX,
        y: y ?? DEFAULTS.originY,
        fontSize: fs,
        color: note.color ? (PALETTE[note.color]?.stroke ?? '#495057') : '#495057',
        align: 'left',
      }),
    );
  }

  return {
    type: 'excalidraw',
    version: 2,
    source: 'eli5-diagram skill',
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: spec.background ?? '#ffffff',
    },
    files: {},
  };
}

function main() {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error('usage: node make-excalidraw.mjs <spec.json> <out.excalidraw>');
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    console.error('spec needs a non-empty "nodes" array');
    process.exit(1);
  }

  const scene = build(spec);
  const out = resolve(outPath);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(scene, null, 2), 'utf8');

  const shapes = scene.elements.filter((e) => e.type !== 'text').length;
  console.log(`wrote ${outPath} — ${scene.elements.length} elements (${shapes} shapes)`);
}

main();
