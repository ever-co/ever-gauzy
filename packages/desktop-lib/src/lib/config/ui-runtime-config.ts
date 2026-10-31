/**
 * The runtime configuration of the web UI that Gauzy Server serves: an inline script setting `window._env`, which the
 * UI reads over the API URL it was built with (`window._env.api`, see `.scripts/configure.ts`).
 *
 * The UI server inserts the script into `index.html` as it serves it (UiService hands it over in
 * {@link UI_RUNTIME_CONFIG_SCRIPT_ENV}), so the install directory is never written to: a .deb under `/opt` is owned by
 * root and an AppImage is mounted read-only (#7735). Where that directory is writable, ServerConfig still writes the
 * same script into the file, as it always did.
 *
 * Every browser gets the same script, so an API URL on a host that names this computer only (the loopback address the
 * default host setting resolves to) would send a browser on another computer to its own loopback address. For such a
 * URL the script has the browser call the API at the host it opened the web UI at instead, on the API's scheme and
 * port: the UI server and the API run on the same computer. A browser on this computer keeps the URL as it is.
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

/**
 * A host that names this computer only: `localhost`, a loopback address, or an "every interface" listen address
 * (`0.0.0.0`, `[::]`). A browser on this computer reaches it, one on another computer does not.
 */
const LOCAL_ONLY_HOST = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i;

/** The scheme and the host of an http(s) URL (an IPv6 host with its brackets). */
const URL_SCHEME_AND_HOST = /^(https?:\/\/)(\[[^\]]*\]|[^/:?#]*)/i;

/**
 * Browser code that answers the API URL it is given (`api`) for the host the page was opened at (`host`): unchanged on
 * this computer (a {@link LOCAL_ONLY_HOST}, or no host), else with its host replaced by the page's, scheme and port
 * kept. It is built from the two patterns above, so the browser decides by the same rules as {@link isLocalOnlyUrl}.
 */
const API_URL_FOR_PAGE_HOST =
	`function (api, host) { return !host || /${LOCAL_ONLY_HOST.source}/i.test(host) ? api : ` +
	`api.replace(/${URL_SCHEME_AND_HOST.source}/i, function (_, scheme) { return scheme + host; }); }`;

/** The URL with `http://` in front when it names no scheme (a host setting may be stored without one). */
function withHttpScheme(url: string): string {
	return url.startsWith('http') ? url : `http://${url}`;
}

/** Whether the host of `url` names this computer only ({@link LOCAL_ONLY_HOST}). */
function isLocalOnlyUrl(url: string): boolean {
	return LOCAL_ONLY_HOST.test(URL_SCHEME_AND_HOST.exec(url)?.[2] ?? '');
}

/**
 * The inline script that points the web UI at `apiUrl`. The URL is written as a JSON string with `<` escaped, so no
 * value can end the string or the script early.
 *
 * When the host of `apiUrl` names this computer only, a browser that opened the web UI at another host (this
 * computer's LAN address or name, from another computer) calls the API at that host, on the scheme and port of
 * `apiUrl`. A browser on this computer gets `apiUrl` as before, and any other URL is the same for every browser.
 *
 * `global` is defined for the browser as before: some of the UI's dependencies expect Node's name for it.
 *
 * @param apiUrl - The API URL the UI calls, with or without its `http://`.
 */
export function buildUiRuntimeConfigScript(apiUrl: string): string {
	const url = withHttpScheme(apiUrl);
	const json = JSON.stringify(url).replace(/</g, '\\u003c');
	const api = isLocalOnlyUrl(url)
		? `(${API_URL_FOR_PAGE_HOST})(${json}, window.location && window.location.hostname)`
		: json;
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
