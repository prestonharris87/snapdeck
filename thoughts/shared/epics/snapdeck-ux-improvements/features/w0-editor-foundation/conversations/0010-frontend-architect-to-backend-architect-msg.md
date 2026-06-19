---
sequence: 0010
from: frontend-architect
to: backend-architect
step: inline-msg
run_id: run-20260619-024338-47818
timestamp: 2026-06-19T02:56:57Z
team: feat-snapdeck-ux-improvements
epic: snapdeck-ux-improvements
feature: w0-editor-foundation
---

FE↔BE contract for w0-editor-foundation — the lossless `model` your `background.js` story stores. I need to agree the wire shape with you before I finalize my serialization story; I'm NOT prescribing your storage approach, just the wire envelope.

**Proposed wire shape on the editor→background resolve payload** (the object `editor.js` resolves to the ANNOTATE handler; additive — `original/annotated/annotations/meta/console/network` all unchanged):

```
model: {
  version: 1,
  items: [
    { id, type: "arrow", x1, y1, x2, y2 },          // existing arrow geometry, now persisted
    { id, type: "box",   x, y, width, height },      // new foundation box primitive
    { id, type: "text",  x, y, text }                // existing point-anchored text, also carried
  ]
}
```

- Field name on the resolve payload: **`model`** (top-level sibling of `annotations`).
- `items` is the full internal editor `model` array **verbatim** — every item, every field.
- Geometry is in the `meta.viewport` coordinate space (stage/CSS px) already on the record.

**Two confirmations I need from you:**

1. **Store verbatim, NO field whitelist.** Persist the entire `model` object (version + every item field) onto the per-screenshot record (proposed `screenshots[].model`) without enumerating/whitelisting fields. This is load-bearing: w1 (text-box) and w2 (rectangle) will add subtype fields to box items, and they must survive your storage path with **zero backend change**. Please confirm you store the object opaquely.

2. **Not added to `/report/save`.** `model` stays in the local in-progress store only; the upstream `/report/save` payload is unchanged. Confirm.

Also: the w0-per-target-reports feature (same wave) owns the report-store keying/record shape. Please coordinate on `#…/active` so `screenshots[].model` survives their re-keying — that seam is yours to hold.

**What I need back:** (a) your story ID(s) for the storage work so I can cite them in my serialization story's `depends_on`, (b) confirm/counter the field name `model` and the `{version, items}` envelope, (c) confirm verbatim/opaque storage + no `/report/save` change.

Drafting my other stories (box primitive, shared transformer, hydration) meanwhile.
