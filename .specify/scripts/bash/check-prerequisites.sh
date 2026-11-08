#!/usr/bin/env bash
# Check that the host has everything Spec Kit needs, at the versions the monorepo requires.
# Usage: bash .specify/scripts/bash/check-prerequisites.sh
#
# The versions follow the root package.json: `engines.node` (>=26), `engines.yarn` (>=1.22)
# and `packageManager` (yarn@1.22.22, i.e. Yarn classic 1.x — Yarn 2+ is refused).

set -euo pipefail

NODE_MIN_MAJOR=26
YARN_MAJOR=1
YARN_MIN_MINOR=22

ok=true

# Prints the major and minor numbers of a version string such as `v26.1.0` or `1.22.22`;
# prints nothing when the string is not a version.
version_parts() {
    local raw="${1#v}"
    if [[ "$raw" =~ ^([0-9]+)\.([0-9]+) ]]; then
        printf '%s %s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    fi
}

report_ok() {
    printf "  [ok]    %-12s %s\n" "$1" "$2"
}

report_miss() {
    printf "  [MISS]  %-12s %s\n" "$1" "$2"
    ok=false
}

check_node() {
    local hint="install Node.js ${NODE_MIN_MAJOR}+ (package.json engines.node >=${NODE_MIN_MAJOR})"
    if ! command -v node >/dev/null 2>&1; then
        report_miss node "$hint"
        return
    fi
    local version parts
    version="$(node --version 2>&1 | head -n1)"
    parts="$(version_parts "$version")"
    if [[ -z "$parts" ]]; then
        report_miss node "unreadable version '$version'; $hint"
    elif (( ${parts%% *} < NODE_MIN_MAJOR )); then
        report_miss node "found $version; $hint"
    else
        report_ok node "$version"
    fi
}

check_yarn() {
    local hint="install Yarn classic ${YARN_MAJOR}.${YARN_MIN_MINOR}+ (packageManager yarn@1.22.22; corepack enable)"
    if ! command -v yarn >/dev/null 2>&1; then
        report_miss yarn "$hint"
        return
    fi
    local version parts major minor
    version="$(yarn --version 2>&1 | head -n1)"
    parts="$(version_parts "$version")"
    if [[ -z "$parts" ]]; then
        report_miss yarn "unreadable version '$version'; $hint"
        return
    fi
    major="${parts%% *}"
    minor="${parts##* }"
    if (( major != YARN_MAJOR || minor < YARN_MIN_MINOR )); then
        report_miss yarn "found $version; $hint"
    else
        report_ok yarn "$version"
    fi
}

check_git() {
    if command -v git >/dev/null 2>&1; then
        report_ok git "$(git --version 2>&1 | head -n1)"
    else
        report_miss git "install Git"
    fi
}

echo "Checking Spec Kit prerequisites…"
check_node
check_yarn
check_git

if $ok; then
    echo
    echo "All prerequisites present."
else
    echo
    echo "Some prerequisites are missing or too old — see hints above." >&2
    exit 1
fi
