# shellcheck shell=bash
# Sourced, not run (hence no shebang), by the dev container's interactive shells: postCreateCommand in
# devcontainer.json adds `. <workspace>/.devcontainer/codespaces-env.sh <workspace>` to ~/.bashrc and ~/.zshrc, so
# `yarn start` and the other scripts started from a terminal see these variables.
#
# In GitHub Codespaces a browser reaches the forwarded ports at https://<codespace>-<port>.<domain>, not at localhost:
# a web UI built with the default API_BASE_URL (http://localhost:3000) would send its API calls to the viewer's own
# machine, and the API would hand out localhost links (uploaded files, e-mails). Inside a codespace this points
# API_BASE_URL and CLIENT_BASE_URL at the forwarded URLs and limits ALLOWED_ORIGINS (CORS) to the web UI's URL. It lists
# what it sets in ENV_LOCAL_NO_OVERRIDE, so that the API and the worker keep these values over the localhost ones of the
# tracked .env.local (see apps/api/src/load-env.ts).
#
# Your own values win: a variable already set in the shell, or set in .env or .env.local to anything but its localhost
# default, is left alone. To use the forwarded localhost ports in VS Code desktop instead, export all three
# (localhost:3000 for the API, localhost:4200 for the other two) before `yarn start`. Outside a codespace (VS Code Dev
# Containers on your machine) it changes nothing.
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
	_gauzy_root=${1:-${CODESPACE_VSCODE_FOLDER:-$PWD}}

	# Succeeds when .env or .env.local in the workspace sets variable $1 to a value other than $2 (an empty $2: to any
	# value). It reads the last `NAME=value` line of each (`export NAME=value` too), without quotes or carriage returns.
	_gauzy_set_in_files() {
		for _gauzy_file in "$_gauzy_root/.env" "$_gauzy_root/.env.local"; do
			[ -f "$_gauzy_file" ] || continue
			_gauzy_value=$(sed -n "s/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}$1[[:space:]]*=[[:space:]]*//p" "$_gauzy_file" | tail -n 1 | tr -d "\r\"'")
			if [ -n "$_gauzy_value" ] && [ "$_gauzy_value" != "$2" ]; then
				return 0
			fi
		done
		return 1
	}

	# Sets variable $1 to $3, unless the shell already has a value for it or a settings file sets one other than $2.
	_gauzy_forward() {
		eval "_gauzy_current=\${$1:-}"
		if [ -n "$_gauzy_current" ] || _gauzy_set_in_files "$1" "$2"; then
			return 0
		fi
		export "$1=$3"
		export ENV_LOCAL_NO_OVERRIDE="${ENV_LOCAL_NO_OVERRIDE:+$ENV_LOCAL_NO_OVERRIDE,}$1"
	}

	_gauzy_forward API_BASE_URL http://localhost:3000 "https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
	_gauzy_forward CLIENT_BASE_URL http://localhost:4200 "https://${CODESPACE_NAME}-4200.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
	if [ -n "${CLIENT_BASE_URL:-}" ]; then
		_gauzy_forward ALLOWED_ORIGINS '' "$CLIENT_BASE_URL"
	fi

	unset -f _gauzy_set_in_files _gauzy_forward
	unset _gauzy_root _gauzy_file _gauzy_value _gauzy_current
fi
