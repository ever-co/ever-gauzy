/**
 * The runtime configuration of the web UI that Gauzy Server serves: an inline script setting `window._env`, which the
 * UI reads over the API URL it was built with (`window._env.api`, see `.scripts/configure.ts`).
 *
 * The UI server inserts the script into `index.html` as it serves it (UiService hands it over in
 * {@link UI_RUNTIME_CONFIG_SCRIPT_ENV}), so the install directory is never written to: a .deb under `/opt` is owned by
 * root and an AppImage is mounted read-only (#7735). Where that directory is writable, ServerConfig still writes the
 * same script into the file, as it always did.
 *
 * Plain string functions with no import, so any process can load them.
 */

/** The variable of the UI server's process that carries {@link buildUiRuntimeConfigScript}'s script. */
export const UI_RUNTIME_CONFIG_SCRIPT_ENV = 'UI_RUNTIME_CONFIG_SCRIPT';

/**
 * A `window._env` script in any format this app has written into `index.html`, up to its own `</script>`, with the
 * line break that follows it. Older releases appended one more on every write that missed their URL pattern.
 */
const RUNTIME_CONFIG_SCRIPT = /<script>\s*window\._env\s*=[\s\S]*?<\/script>\r?\n?/g;

/** The closing body tag the script goes in front of. */
const BODY_END = '</body>';

/** The URL with `http://` in front when it names no scheme (a host setting may be stored without one). */
function withHttpScheme(url: string): string {
	return url.startsWith('http') ? url : `http://${url}`;
}

/**
 * The inline script that points the web UI at `apiUrl`. The URL is written as a JSON string with `<` escaped, so no
 * value can end the string or the script early.
 *
 * `global` is defined for the browser as before: some of the UI's dependencies expect Node's name for it.
 *
 * @param apiUrl - The API URL the UI calls, with or without its `http://`.
 */
export function buildUiRuntimeConfigScript(apiUrl: string): string {
	const api = JSON.stringify(withHttpScheme(apiUrl)).replace(/</g, '\\u003c');
	return `<script>window._env = { api: ${api} }; if (typeof global === 'undefined') { var global = window; }</script>`;
}

/** `html` with `snippet` and a line break in front of its last `</body>`, or at its end when it has none. */
function insertBeforeBodyEnd(html: string, snippet: string): string {
	const index = html.toLowerCase().lastIndexOf(BODY_END);
	return index === -1 ? `${html}${snippet}\n` : `${html.slice(0, index)}${snippet}\n${html.slice(index)}`;
}

/**
 * `html` with exactly one runtime configuration script, pointing at `apiUrl`: any earlier one (several, in the
 * format of any release) is taken out and the current one goes in front of `</body>`. Applying it twice gives the
 * same document, so an unchanged URL leaves the file as it is.
 *
 * @param html - The UI's `index.html`.
 * @param apiUrl - The API URL the UI calls.
 */
export function applyUiRuntimeConfig(html: string, apiUrl: string): string {
	return insertBeforeBodyEnd(html.replace(RUNTIME_CONFIG_SCRIPT, ''), buildUiRuntimeConfigScript(apiUrl));
}
