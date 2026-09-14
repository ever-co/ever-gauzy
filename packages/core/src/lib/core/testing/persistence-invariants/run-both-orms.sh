#!/usr/bin/env bash
# Runs the unified persistence-invariant suite under BOTH ORM backends and fails if either does.
# See this folder's README and orm-conformance/README.md for why that's two process invocations,
# not one switching test.
#
# Usage: run from the repo root.
#   packages/core/src/lib/core/testing/persistence-invariants/run-both-orms.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== Persistence invariants: TypeORM =="
DB_ORM=typeorm npx nx test core --testFile=persistence-invariant.spec.ts --skip-nx-cache

echo "== Persistence invariants: MikroORM =="
DB_ORM=mikro-orm npx nx test core --testFile=persistence-invariant.spec.ts --skip-nx-cache

echo "Tenant isolation holds under both ORMs."
