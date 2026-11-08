#!/usr/bin/env bash
# Bootstrap a new Spec Kit feature directory under docs/specs/features/.
#
# Usage: bash .specify/scripts/bash/create-new-feature.sh <slug> ["Feature Title"]
#
# <slug> is one directory name: lower-case letters, digits and hyphens, starting with a
# letter or a digit, at most 64 characters (for example `task-views`). The title is any
# one-line text; it is inserted literally (`Import/Export`, `R&D` and `$&` stay as typed).
#
# Creates docs/specs/features/<slug>/ with:
#   - spec.md   (from .specify/templates/spec-template.md)
#   - plan.md   (from .specify/templates/plan-template.md)
#   - tasks.md  (from .specify/templates/tasks-template.md)
# Each is pre-populated with the slug, title, and today's date (UTC). Nothing is left
# behind when a step fails.

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
    echo "Usage: bash $0 <slug> [\"Feature Title\"]" >&2
    exit 1
fi

slug="$1"
title="${2:-$slug}"

# One safe path component: no `/`, no `..`, no leading hyphen, no upper case.
slug_pattern='^[a-z0-9][a-z0-9-]{0,63}$'
if [[ ! "$slug" =~ $slug_pattern ]]; then
    echo "Invalid slug '$slug': use lower-case letters, digits and hyphens (1-64 characters, starting with a letter or digit)." >&2
    exit 1
fi

if [[ "$title" == *$'\n'* || "$title" == *$'\r'* ]]; then
    echo "The title must be a single line." >&2
    exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
templates="$repo_root/.specify/templates"
features_dir="$repo_root/docs/specs/features"
out_dir="$features_dir/$slug"

if [[ ! -d "$templates" ]]; then
    echo "Cannot find $templates — run from inside the monorepo." >&2
    exit 1
fi

if [[ -e "$out_dir" ]]; then
    echo "Feature directory already exists: $out_dir" >&2
    exit 1
fi

# Fills the placeholders of a template as plain text, in one pass: the values travel through the
# environment (awk's ENVIRON never interprets escapes) and are spliced in with index/substr, so no
# sed, regex or shell substitution ever sees the title or the slug, and a value is never re-scanned.
fill_template() {
    SPEC_TITLE="$title" SPEC_SLUG="$slug" SPEC_TODAY="$today" awk '
        BEGIN {
            n = 3
            ph[1] = "[FEATURE NAME]"; val[1] = ENVIRON["SPEC_TITLE"]
            ph[2] = "[short-slug]";   val[2] = ENVIRON["SPEC_SLUG"]
            ph[3] = "YYYY-MM-DD";     val[3] = ENVIRON["SPEC_TODAY"]
        }
        {
            s = $0; out = ""
            while (1) {
                best = 0; which = 0
                for (k = 1; k <= n; k++) {
                    i = index(s, ph[k])
                    if (i > 0 && (best == 0 || i < best)) { best = i; which = k }
                }
                if (!best) break
                out = out substr(s, 1, best - 1) val[which]
                s = substr(s, best + length(ph[which]))
            }
            print out s
        }
    ' "$1"
}

mkdir -p "$features_dir"
mkdir "$out_dir"
# From here on, any exit before the end (a failed step under `set -e`, an unset variable, Ctrl-C,
# a TERM) removes the half-made directory, so a rerun starts clean. A signal ends the script:
# it never resumes the loop after the cleanup.
done_ok=false
cleanup() {
    if [[ "$done_ok" != true ]]; then
        rm -rf -- "$out_dir"
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

today=$(date -u +%Y-%m-%d)

for kind in spec plan tasks; do
    src="$templates/${kind}-template.md"
    dst="$out_dir/${kind}.md"
    fill_template "$src" > "$dst"
    echo "  + $dst"
done

done_ok=true

cat <<EOF

Created Spec Kit feature directory: $out_dir

Next steps:
  1. Open spec.md and replace placeholders.
  2. Once approved, fill in plan.md.
  3. Once plan is approved, expand tasks.md.

EOF
