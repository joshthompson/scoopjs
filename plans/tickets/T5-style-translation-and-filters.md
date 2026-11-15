# T5: Style translation and filters

Blocked by: T4
Status: done, merged into canvas-renderer in cdb0679

Spec: [canvas-spec.md](../canvas-spec.md). User stories 21–22 and 46–54. Implementation Decisions → Style translator and Filter applier, and Contracts → Translated style keys. ADR 0002.

The style translator turns a Controller's `style` into canvas state:
- alpha, multiplied through carriers
- hidden or not (`display: none` also hides attached parts)
- `z-index`
- the extra transform
- a filter description
- the list of untranslatable keys, for T7 to report

The filter applier:
- uses `ctx.filter` where it's supported, detected once
- otherwise recolours each Frame once per rounded filter value and caches it (hue to a whole degree, others to 0.01)
- always sends `drop-shadow` through the context's shadow settings

The untranslatable keys only need returning here, not reporting. That's T7.

Done when Seam 2 tests cover every translated key, `z-index` at both levels, and the fallback, with the stub reporting no `filter` support. Add a changeset (minor).
