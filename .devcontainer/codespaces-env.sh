# shellcheck shell=bash
# Sourced, not run (hence no shebang), by the dev container's interactive shells: postCreateCommand in
# devcontainer.json adds `. <workspace>/.devcontainer/codespaces-env.sh <workspace>` to ~/.bashrc and ~/.zshrc, so
# `yarn start` and the other scripts started from a terminal see these variables.
#
# In GitHub Codespaces a browser reaches the forwarded ports at https://<codespace>-<port>.<domain>, not at localhost:
# a web UI built with the default API_BASE_URL (http://localhost:3000) would send its API calls to the viewer's own
# machine, and the API would hand out localhost links (uploaded files, e-mails). Inside a codespace this sets
# API_BASE_URL and CLIENT_BASE_URL to the forwarded URLs and ALLOWED_ORIGINS (CORS) to the web UI's URL.
#
# Your own values win, in this order: a value the shell already has, then one you wrote in .env.local, then one in
# .env (in those files, anything but the localhost default; the API reads .env.local over .env). Whichever value it
# settles on is exported, so the web UI's build sees it too, and listed in ENV_LOCAL_NO_OVERRIDE, so that the API and
# the worker keep it over the localhost values of the tracked .env.local (see apps/api/src/load-env.ts). To use the
# forwarded localhost ports in VS Code desktop instead, export all three (localhost:3000 for the API, localhost:4200
# for the other two) before `yarn start`. Outside a codespace (VS Code Dev Containers on your machine) it changes
# nothing.
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
	_gauzy_root=${1:-${CODESPACE_VSCODE_FOLDER:-$PWD}}

	# Prints the value .env.local, else .env, in the workspace gives variable $1, unless it is empty or $2 (an empty
	# $2: any value counts). It reads the last `NAME=value` line of each file (`export NAME=value` too) as dotenv does:
	# the text between its quotes when it is quoted, otherwise the text before any `#` comment, without surrounding
	# whitespace or a carriage return. Prints nothing when neither file sets one.
	_gauzy_file_value() {
		for _gauzy_file in "$_gauzy_root/.env.local" "$_gauzy_root/.env"; do
			[ -f "$_gauzy_file" ] || continue
			_gauzy_value=$(sed -n "s/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}$1[[:space:]]*=[[:space:]]*//p" "$_gauzy_file" |
				tail -n 1 | tr -d '\r' |
				sed -e 's/^"\([^"]*\)".*$/\1/' -e 't' -e "s/^'\([^']*\)'.*\$/\1/" -e 't' -e 's/^`\([^`]*\)`.*$/\1/' -e 't' \
					-e 's/#.*$//' -e 's/[[:space:]]*$//')
			if [ -n "$_gauzy_value" ] && [ "$_gauzy_value" != "$2" ]; then
				printf '%s' "$_gauzy_value"
				return 0
			fi
		done
	}

	# Exports variable $1 with the value the shell already has, else the one your settings files give it (anything
	# but $2), else $3, and lists it in ENV_LOCAL_NO_OVERRIDE (once).
	_gauzy_keep() {
		eval "_gauzy_current=\${$1:-}"
		if [ -z "$_gauzy_current" ]; then
			_gauzy_current=$(_gauzy_file_value "$1" "$2")
		fi
		export "$1=${_gauzy_current:-$3}"
		case ",${ENV_LOCAL_NO_OVERRIDE:-}," in
			*",$1,"*) ;;
			*) export ENV_LOCAL_NO_OVERRIDE="${ENV_LOCAL_NO_OVERRIDE:+$ENV_LOCAL_NO_OVERRIDE,}$1" ;;
		esac
	}

	_gauzy_keep API_BASE_URL http://localhost:3000 "https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
	_gauzy_keep CLIENT_BASE_URL http://localhost:4200 "https://${CODESPACE_NAME}-4200.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
	_gauzy_keep ALLOWED_ORIGINS '' "$CLIENT_BASE_URL"

	unset -f _gauzy_file_value _gauzy_keep
	unset _gauzy_root _gauzy_file _gauzy_value _gauzy_current
fi
