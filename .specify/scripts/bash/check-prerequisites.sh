#!/usr/bin/env bash
# Check that the host has everything Spec Kit needs.
# Usage: .specify/scripts/bash/check-prerequisites.sh

set -euo pipefail

ok=true
check() {
    local cmd="$1"
    local hint="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        printf "  [ok]    %-12s %s\n" "$cmd" "$($cmd --version 2>&1 | head -n1)"
    else
        printf "  [MISS]  %-12s %s\n" "$cmd" "$hint"
        ok=false
    fi
}

echo "Checking Spec Kit prerequisites…"
check yarn "install yarn 1.x (corepack enable)"
check node "install Node.js 20+"
check git  "install Git"

if $ok; then
    echo
    echo "All prerequisites present."
else
    echo
    echo "Some prerequisites missing — see hints above." >&2
    exit 1
fi
