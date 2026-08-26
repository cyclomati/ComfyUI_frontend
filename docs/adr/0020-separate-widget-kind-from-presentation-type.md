# 20. Separate Widget Kind from Presentation Type

Date: 2026-08-24

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

[ADR 0008](0008-entity-component-system.md) classifies a widget's `name` and
`type` as identity, and makes dedicated stores authoritative for widget data.
The extension API predates that model: `IBaseWidget.type` is a public writable
property, and custom nodes change it after registration to select a different
renderer or interaction model.

Those meanings conflict. A semantic identity should be stable after registration
so indexes, serialization, projections, and systems can rely on it. Renderer
selection is presentation state and may legitimately change during a widget's
lifetime. Using one string for both creates two failure modes:

- Treating `type` as immutable breaks extensions that use post-registration
  assignment as a presentation switch.
- Treating the live widget object as authoritative allows it to drift from the
  widget store. Store-driven Vue consumers can then select a different component
  from legacy consumers of the live object.

PR [#15766](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15766) is a
compatibility repair: after registration, legacy `widget.type = value` writes
through to the widget state used by Vue component dispatch. It removes the
immediate split-brain behavior, but retaining a mutable identity field is not the
desired long-term API.

The migration also has to account for widgets that exist only as projections,
including promoted subgraph widgets, and for extensions compiled against the
current `IBaseWidget` interface. A consumer-only fallback to
`liveWidget.type ?? widgetState.type` cannot cover projections with no live
widget and is not reliably reactive when an extension assigns a plain object
property.

## Decision

Separate semantic widget identity from presentation dispatch:

1. Add an immutable `kind` to widget state. `kind` identifies the widget's
   semantic contract and is fixed when the widget is registered.
2. Add a store-backed `presentationType`. Vue component selection and other
   presentation behavior use this field. It may change through a validated widget
   store action and, once widget commands are available, through the corresponding
   serializable command.
3. Keep `IBaseWidget.type` as a deprecated compatibility property during the
   extension migration. Before registration it initializes both fields. After
   registration, reads project `presentationType` and writes update
   `presentationType`; writes never mutate `kind`.
4. Emit a development-mode deprecation warning for post-registration `type`
   assignment, with migration guidance to the explicit presentation API.
5. Store-driven consumers read `kind` or `presentationType` according to their
   purpose. They do not fall back to the live widget object. Live widgets and
   promoted-widget adapters project the same authoritative store state.
6. Serialization records `kind` wherever semantic reconstruction requires it.
   `presentationType` is serialized only when changing presentation is persistent
   workflow state rather than an ephemeral UI choice. Each mutable presentation
   use case must make that persistence decision explicitly.
7. Remove writable `type` only after an announced deprecation window and ecosystem
   evidence show that supported extensions have migrated.

The initial names are deliberately distinct from the overloaded legacy name:
`kind` answers "what widget contract is this?" and `presentationType` answers
"how should it be presented now?"

Alternatives considered:

- **Make `type` immutable immediately.** Rejected because post-registration
  assignment is an existing extension behavior with no supported replacement.
- **Keep `type` as the permanently mutable canonical field.** Rejected because
  identity and presentation retain incompatible lifecycle and persistence rules.
- **Make each Vue consumer prefer the live widget's `type`.** Rejected because it
  creates two authorities, misses store-only projections, depends on every future
  consumer applying the same fallback, and does not make plain-property writes
  reactive by itself.
- **Rename `type` to `kind` without adding presentation state.** Rejected because
  it removes the mechanism custom nodes currently use to change renderer behavior.
- **Store a renderer component directly on the widget.** Rejected because
  components are not serializable domain state and would couple widget entities to
  the Vue renderer.

## Consequences

### Positive

- Widget identity becomes stable and suitable for indexing, reconstruction, and
  deterministic commands.
- Dynamic renderer changes remain supported without mutating identity.
- Vue, legacy adapters, and promoted widgets observe one authoritative reactive
  value instead of applying consumer-specific fallback rules.
- The deprecated property provides a staged migration path for custom nodes rather
  than an ecosystem-wide breaking change.
- Persistence decisions become explicit instead of inheriting ambiguous behavior
  from the overloaded `type` property.

### Negative

- Widget state and APIs gain two related fields, and callers must choose the right
  one.
- During migration, `type` and `presentationType` are aliases, which adds temporary
  compatibility machinery and documentation burden.
- Existing widget subclasses and custom nodes require migration, telemetry or
  ecosystem testing, and a deprecation window before the legacy setter can be
  removed.
- Determining whether each presentation change is durable or ephemeral requires an
  audit; serializing all or none of them would be simpler but incorrect for some
  widgets.
- Widget mutation commands are not yet complete, so the first implementation will
  use a validated store action before it can satisfy the full command architecture.

## Notes

- [ADR 0008](0008-entity-component-system.md) defines widget identity and the
  dedicated-store authority this proposal refines.
- [ADR 0003](0003-crdt-based-layout-system.md) defines the longer-term command
  properties required for durable graph-domain mutations.
- The compatibility repair in PR #15766 should not be interpreted as making
  mutable widget identity permanent.
