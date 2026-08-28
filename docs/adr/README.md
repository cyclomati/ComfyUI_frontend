# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the ComfyUI Frontend project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why certain decisions were made and provide a historical record of the project's evolution.

## ADR Index

| ADR                                                                             | Title                                                            | Status   | Date       |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- | ---------- |
| [AF](AF-adopt-fallow.md)                                                        | Adopt Fallow                                                     | Proposed | 2026-06-29 |
| [BRR](BRR-bound-renderer-reactivity.md)                                         | Bound Renderer Reactivity                                        | Proposed | 2026-08-26 |
| [BTACWS](BTACWS-billing-telemetry-attempt-correlation-and-workspace-scoping.md) | Billing Telemetry Attempt Correlation and Workspace Scoping      | Proposed | 2026-07-28 |
| [CCCI](CCCI-classify-and-coalesce-canvas-invalidation.md)                       | Classify and Coalesce Canvas Invalidation                        | Proposed | 2026-08-26 |
| [CLMC](CLMC-crdt-based-layout-system.md)                                        | Centralized Layout Management with CRDT                          | Proposed | 2025-08-27 |
| [CRNCV](CRNCV-cloud-release-notes-use-comfyui-version.md)                       | Cloud Release Notes Use the ComfyUI Version                      | Accepted | 2026-07-13 |
| [DCLCA](DCLCA-derived-credential-lifecycle.md)                                  | Derived Credential Lifecycle for Cloud Auth                      | Proposed | 2026-07-09 |
| [ECS](ECS-entity-component-system.md)                                           | Entity Component System                                          | Proposed | 2026-03-23 |
| [ERCRB](ERCRB-entity-registration-collision-and-recovery-boundaries.md)         | Entity Registration Collision and Recovery Boundaries            | Proposed | 2026-08-24 |
| [FPUL](FPUL-fork-primevue-ui-library.md)                                        | Fork PrimeVue UI Library                                         | Rejected | 2025-08-27 |
| [IBSROSS](IBSROSS-id-based-slot-records-are-the-slot-destination.md)            | ID-Based Slot Records Own Slot State                             | Accepted | 2026-08-24 |
| [MLCF](MLCF-merge-litegraph-into-frontend.md)                                   | Merge LiteGraph.js into ComfyUI Frontend                         | Accepted | 2025-08-05 |
| [NEOPS](NEOPS-node-execution-output-passthrough-schema.md)                      | NodeExecutionOutput Passthrough Schema Design                    | Accepted | 2026-03-11 |
| [NIRM](NIRM-node-id-reminting-at-the-merge-boundary.md)                         | Node-ID Reminting at the Merge Boundary                          | Proposed | 2026-08-25 |
| [PMCIP](PMCIP-performance-measurement-and-ci-policy.md)                         | Performance Measurement and CI Policy                            | Proposed | 2026-08-26 |
| [PNCPL](PNCPL-primitive-node-copy-paste-lifecycle.md)                           | PrimitiveNode Copy/Paste Lifecycle                               | Proposed | 2026-02-22 |
| [RCM](RCM-monorepo-conversion.md)                                               | Restructure ComfyUI_frontend as a monorepo                       | Accepted | 2025-08-25 |
| [RIMVE](RIMVE-remove-importmap-for-vue-extensions.md)                           | Remove Import Map for Vue Extensions                             | Accepted | 2025-12-13 |
| [RNO](RNO-remove-nx-orchestration.md)                                           | Remove Nx Orchestration                                          | Accepted | 2026-05-19 |
| [SPWLI](SPWLI-subgraph-promoted-widgets-use-linked-inputs.md)                   | Subgraph promoted widgets use linked inputs                      | Proposed | 2026-05-05 |
| [TSS](TSS-telemetry-service-selection.md)                                       | Telemetry Service Selection: PostHog, Datadog RUM, Snowflake/Hex | Accepted | 2026-07-28 |
| [URD](URD-unified-recoverable-diagnostics.md)                                   | Unified Recoverable Diagnostics                                  | Proposed | 2026-08-25 |
| [WELLB](WELLB-widget-entities-and-legacy-behavior-boundary.md)                  | Widget Entities and Legacy Behavior Boundary                     | Proposed | 2026-08-26 |

## Creating a New ADR

1. Choose a unique, memorable acronym derived from the ADR title
2. Name the file `<ACRONYM>-descriptive-title.md`, using an all-caps acronym
3. Fill in all sections
4. Update this index
5. Submit as part of your PR

## ADR Template

```markdown
# ADR-ACRONYM: Title

Date: YYYY-MM-DD

## Status

[Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-ACRONYM](ACRONYM-title.md)]

## Context

Describe the issue that motivated this decision and any context that influences or constrains the decision.

- What is the problem?
- Why does it need to be solved?
- What forces are at play (technical, business, team)?

## Decision

Describe the decision that was made and the key points that led to it.

- What are we going to do?
- How will we do it?
- What alternatives were considered?

## Consequences

### Positive

- What becomes easier or better?
- What opportunities does this create?

### Negative

- What becomes harder or worse?
- What risks are we accepting?
- What technical debt might we incur?

## Notes

Optional section for additional information, references, or clarifications.
```

## ADR Status Values

- **Proposed**: The decision is being discussed
- **Accepted**: The decision has been agreed upon
- **Rejected**: The decision was not accepted
- **Deprecated**: The decision is no longer relevant
- **Superseded**: The decision has been replaced by another ADR

## Further Reading

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) by Michael Nygard
- [Architecture Decision Records](https://adr.github.io/) - Collection of ADR resources
