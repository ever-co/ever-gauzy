#!/usr/bin/env bash
set -euo pipefail

action_file="${1:-$(dirname "$0")/action.yml}"

# Execute the production escaping and annotation-emission lines so this test
# fails if the action ever stops encoding workflow-command control characters.
escape_block="$({
	awk '
		/reset_err="\$\{reset_err\/\/%\/%25\}"/ { capture = 1 }
		capture {
			sub(/^          /, "")
			print
		}
		capture && /echo "::error title=/ { exit }
	' "$action_file"
})"

if [[ -z "$escape_block" ]]; then
	echo "Could not find the workflow-command escaping block in $action_file" >&2
	exit 1
fi

assert_encoded() {
	local diagnostic="$1"
	local expected="$2"
	local output

	reset_failed=" .npmrc(git-exit-128)"
	reset_err="$diagnostic"
	output="$(eval "$escape_block")"

	if [[ "$output" == *$'\r'* || "$output" == *$'\n'* ]]; then
		echo "Workflow command contains an unescaped CR or LF" >&2
		printf '%q\n' "$output" >&2
		exit 1
	fi
	if [[ "$output" != *"$expected"* ]]; then
		echo "Workflow command does not contain expected encoding: $expected" >&2
		printf '%q\n' "$output" >&2
		exit 1
	fi
}

assert_encoded 'fatal: progress 100% complete' 'fatal: progress 100%25 complete'
assert_encoded $'fatal: CR\r::warning title=injected::message' 'fatal: CR%0D::warning title=injected::message'
assert_encoded $'fatal: LF\n::warning title=injected::message' 'fatal: LF%0A::warning title=injected::message'

echo "workflow-command escaping contract: PASS"
