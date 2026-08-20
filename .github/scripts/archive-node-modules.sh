#!/usr/bin/env bash
#
# Packs the installed dependency tree into ONE compressed file for the other jobs to unpack.
#
# Paired with restore-node-modules.sh. A single ~2.9 GB file beats handing actions/cache ~900k loose
# files in both directions, and it is small enough to sit in the 10 GB per-repo cache budget — which
# the exploded ~9 GB tree never was.
set -o pipefail

ARCHIVE="${NODE_MODULES_ARCHIVE:?NODE_MODULES_ARCHIVE must be set}"

PATHS=()
for p in node_modules apps/*/node_modules packages/*/node_modules \
	packages/plugins/*/node_modules tools/node_modules; do
	[ -d "$p" ] && PATHS+=("$p")
done
if [ ${#PATHS[@]} -eq 0 ]; then
	echo "::error::install produced no node_modules directories"
	exit 1
fi
echo "archiving ${#PATHS[@]} directories"

if command -v zstd >/dev/null 2>&1; then
	COMPRESS="zstd -3 -T0"
else
	echo "::warning::zstd unavailable — falling back to gzip (larger archive, slower)"
	COMPRESS="gzip -3"
fi

# `--warning=no-file-changed` because yarn's daemon can touch files while we read them; `|| [ $? -eq 1 ]`
# accepts tar's "file changed as we read it" (exit 1) while still failing on a real error (exit 2).
tar --warning=no-file-changed --use-compress-program="$COMPRESS" \
	-cf "$ARCHIVE" "${PATHS[@]}" || [ $? -eq 1 ]

# Tolerating exit 1 means a TRUNCATED archive could be published, and every consumer would then fall
# back to its own multi-hour install. A cheap size floor catches the gross case.
size=$(stat -c%s "$ARCHIVE")
ls -lh "$ARCHIVE"
if [ "$size" -lt 104857600 ]; then
	echo "::error::archive is only $size bytes — the dependency tree cannot be that small"
	exit 1
fi
