# Sourced by the dev container's interactive shells (postCreateCommand in devcontainer.json adds it to ~/.bashrc and
# ~/.zshrc), so `yarn start` and the other scripts started from a terminal see these variables.
#
# In GitHub Codespaces a browser reaches the forwarded ports at https://<codespace>-<port>.<domain>, not at localhost:
# a web UI built with the default API_BASE_URL (http://localhost:3000) would send its API calls to the viewer's own
# machine. Inside a codespace this points API_BASE_URL and CLIENT_BASE_URL at the forwarded URLs and limits
# ALLOWED_ORIGINS (CORS) to the web UI's URL. A value already set wins, and a .env file overrides these for the API;
# to use the forwarded localhost ports in VS Code desktop instead, export all three (localhost:3000 for the API,
# localhost:4200 for the other two) before `yarn start`. Outside a codespace (VS Code Dev Containers on your machine)
# it changes nothing.
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
	export API_BASE_URL="${API_BASE_URL:-https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}}"
	export CLIENT_BASE_URL="${CLIENT_BASE_URL:-https://${CODESPACE_NAME}-4200.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}}"
	export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-${CLIENT_BASE_URL}}"
fi
