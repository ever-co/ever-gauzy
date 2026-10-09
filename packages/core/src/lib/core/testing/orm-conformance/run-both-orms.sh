#!/usr/bin/env bash
# Runs the TypeORM <-> MikroORM conformance suite under BOTH backends and fails if either does.
#
# Why a script instead of one `jest` invocation: `DB_ORM` is read once at process start by several
# core modules (see the README in this folder), so the two ORMs cannot be exercised in the same
# process — each run below is its own process, with its own fresh module cache.
#
# Usage: run from the repo root.
#   packages/core/src/lib/core/testing/orm-conformance/run-both-orms.sh

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== ORM conformance: TypeORM =="
DB_ORM=typeorm yarn nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache

echo "== ORM conformance: MikroORM =="
DB_ORM=mikro-orm yarn nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache

echo "Both ORMs conform."
