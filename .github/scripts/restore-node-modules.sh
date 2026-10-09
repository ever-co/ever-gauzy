#!/usr/bin/env bash
#
# Restores the dependency tree published by the `deps` job, or bootstraps from scratch.
#
# Both consumers (build, and each e2e shard) ran identical copies of this inline, and they had
# already drifted once — a fix applied to one block missed the other. It is also deliberately ONE
# step rather than an unpack step plus a conditional fallback: a step `if:` carrying no status-check
# function is implicitly ANDed with `success()`, so a fallback gated on a previous step's outcome
# never runs after that step fails hard. Doing both here removes that trap by construction.
set -o pipefail

ARCHIVE="${NODE_MODULES_ARCHIVE:?NODE_MODULES_ARCHIVE must be set}"

# Explicit decompression rather than tar's magic-byte auto-detect: GNU tar shells out to an external
# `zstd`, so auto-detect needs tar >= 1.31 AND zstd on THIS host, while the archiving host only
# needed `--use-compress-program`. Try each in turn so a mismatch degrades to the bootstrap below.
extract() {
	[ -f "$ARCHIVE" ] || return 1
	if zstd -dc "$ARCHIVE" 2>/dev/null | tar -xf -; then echo "extracted (zstd)"; return 0; fi
	if gzip -dc "$ARCHIVE" 2>/dev/null | tar -xf -; then echo "extracted (gzip)"; return 0; fi
	if tar -xf "$ARCHIVE"; then echo "extracted (tar auto-detect)"; return 0; fi
	return 1
}

if extract && [ -d node_modules ]; then
	rm -f "$ARCHIVE"
	exit 0
fi

echo "::warning::node_modules archive unavailable — falling back to a full bootstrap (1-3 h on these runners)."
# Clear any partial extraction first: a half-written tree can still carry a
# `node_modules/.yarn-integrity` that convinces yarn everything is already installed.
rm -rf "$ARCHIVE" node_modules apps/*/node_modules packages/*/node_modules \
	packages/plugins/*/node_modules tools/node_modules
# `bootstrap:ci`, not `bootstrap`: the developer-facing script drops --frozen-lockfile (so a
# package.json/lockfile disagreement would be silently rewritten and reported green, while the
# Docker image builds that DO install frozen fail later) and --network-timeout (yarn 1 defaults to
# 30s per request, and this is the degraded path on a pool already documented as slow).
yarn bootstrap:ci || { echo "::warning::bootstrap failed — retry 1"; yarn bootstrap:ci; }
