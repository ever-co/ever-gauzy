# `.specify/` — Ever Gauzy Spec Kit

This folder is the Ever Gauzy adaptation of the
[GitHub Spec Kit](https://github.com/github/spec-kit) workflow: the project
constitution, the spec / plan / tasks templates, and the bootstrap scripts.
The feature specs themselves live in [`docs/specs/`](../docs/specs/).

## Layout

```
.specify/
├── memory/
│   └── constitution.md          # Project principles (highest priority)
├── templates/
│   ├── spec-template.md         # Behaviour spec template
│   ├── plan-template.md         # Implementation plan template
│   └── tasks-template.md        # Task breakdown template
└── scripts/
    ├── bash/
    │   ├── create-new-feature.sh   # Scaffold a feature dir under docs/specs/features/
    │   └── check-prerequisites.sh
    └── powershell/
        └── create-new-feature.ps1
```

Where the specs go:

```
docs/specs/
├── README.md                       # Index of all specs, architecture docs and ADRs
├── architecture/                   # Cross-feature architecture docs
├── decisions/                      # Architecture Decision Records (ADRs)
└── features/                       # Spec Kit feature directories
    └── <feature-slug>/
        ├── spec.md                 # Behaviour-first spec (what, not how)
        ├── plan.md                 # Implementation plan (how)
        └── tasks.md                # Ordered task breakdown (PR-sized)
```

## Workflow

1. **`/specify`** — describe the behaviour. Output: `spec.md`.
2. **`/plan`** — derive the implementation plan. Output: `plan.md`.
3. **`/tasks`** — break the plan into ordered, PR-sized tasks. Output: `tasks.md`.
4. **`/implement`** — work through `tasks.md`, ticking tasks as PRs land, behind a
   default-off feature flag until the feature is complete.

Every step runs through the [constitution gates](memory/constitution.md#compliance-checklist):
a spec that conflicts with a non-negotiable principle blocks the next step.

Scaffold a feature:

```bash
.specify/scripts/bash/create-new-feature.sh <slug> "Feature Title"
```
