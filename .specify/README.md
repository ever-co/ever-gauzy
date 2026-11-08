# `.specify/` — Ever Gauzy Spec Kit

This folder is the Ever Gauzy adaptation of the
[GitHub Spec Kit](https://github.com/github/spec-kit) workflow: the project
constitution, the spec / plan / tasks templates, and the bootstrap scripts.
The feature specs themselves live in [`docs/specs/`](../docs/specs/).

## Layout

```text
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
    │   └── check-prerequisites.sh  # Node.js 26+, Yarn classic 1.22+, Git
    └── powershell/
        ├── create-new-feature.ps1  # Same, for PowerShell 7 (Windows, macOS, Linux)
        └── check-prerequisites.ps1
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

Scaffold a feature (run the scripts through `bash` / `pwsh`, so no executable bit or
execution policy is needed):

```bash
bash .specify/scripts/bash/check-prerequisites.sh
bash .specify/scripts/bash/create-new-feature.sh <slug> "Feature Title"
```

```powershell
pwsh -File .specify/scripts/powershell/check-prerequisites.ps1
pwsh -File .specify/scripts/powershell/create-new-feature.ps1 -Slug <slug> -Title "Feature Title"
```

`<slug>` is one directory name: lower-case letters, digits and hyphens, starting with a
letter or a digit, at most 64 characters (`task-views`); anything else (`../x`, `A/B`) is
refused. The title is inserted literally, punctuation included (`Import/Export`,
`Tasks & Views`). A run that fails leaves no partial directory behind.

The prerequisites follow the root `package.json`: Node.js 26+ (`engines.node`) and Yarn
classic 1.22+ (`engines.yarn`, `packageManager: yarn@1.22.22`); Yarn 2+ is refused.
