/**
 * The UI's start page with the snippet the UI server is given: Gauzy Server's runtime configuration (the script that
 * points the web UI at its API), inserted as the page is served, so the install directory is never written to (#7735).
 *
 * The UI server is a plain Node process forked from Electron's, which cannot load `@gauzy/desktop-lib` (it needs
 * Electron): desktop-lib builds the script (`ui-runtime-config.ts`) and hands it over in `UI_RUNTIME_CONFIG_SCRIPT`,
 * and this module only places it.
 */
import { IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'node:fs';
import * as path from 'node:path';

/** The UI's start page, at the root of the directory the UI server serves. */
const INDEX_FILE = 'index.html';

/**
 * Whether `req` asks for the UI's start page: `/` or `/index.html` (any query string), read with GET or HEAD. The path
 * is compared as sent, not normalised, so anything else (`..`, escapes) stays with serve-static's checks.
 */
export function isIndexHtmlRequest(req: IncomingMessage): boolean {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		return false;
	}
	const [pathname] = (req.url || '').split('?', 1);
	return pathname === '/' || pathname === `/${INDEX_FILE}`;
}

/**
 * `html` with `snippet` and a line break in front of its last `</body>` (at its end when it has none), or `html` as it
 * is when it already holds `snippet`: an install whose UI directory is writable has the same script in the file.
 */
export function insertIntoIndexHtml(html: string, snippet: string): string {
	if (html.includes(snippet)) {
		return html;
	}
	const index = html.toLowerCase().lastIndexOf('</body>');
	return index === -1 ? `${html}${snippet}\n` : `${html.slice(0, index)}${snippet}\n${html.slice(index)}`;
}

/**
 * Answers `req` with the `index.html` of `root` and `snippet` inserted ({@link insertIntoIndexHtml}). The file on disk
 * is only read. `Cache-Control: no-cache` makes a browser ask again each time, so a changed snippet (a new API URL)
 * shows on the next load. When the file cannot be read, `fallback` answers instead.
 */
export function serveIndexHtml(
	root: string,
	snippet: string,
	req: IncomingMessage,
	res: ServerResponse,
	fallback: () => void
): void {
	readFile(path.join(root, INDEX_FILE), 'utf8', (error, html) => {
		if (error) {
			fallback();
			return;
		}
		const body = insertIntoIndexHtml(html, snippet);
		res.statusCode = 200;
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.setHeader('Content-Length', Buffer.byteLength(body));
		res.setHeader('Cache-Control', 'no-cache');
		res.end(req.method === 'HEAD' ? undefined : body);
	});
}
