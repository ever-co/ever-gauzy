/**
 * @jest-environment node
 */
import { IncomingMessage } from 'node:http';
import { insertIntoIndexHtml, isIndexHtmlRequest } from './index-html';
import { UI_RUNTIME_CONFIG_SCRIPT_ENV } from './static-file-server';

/**
 * The start page of Gauzy Server's UI, served with the runtime config script the launcher hands over (#7735). The
 * launcher's side (desktop-lib's `ui-runtime-config.ts`) cannot be loaded in this process, which has no Electron, so the
 * variable's name and the placement of the script are pinned on both sides, in this file and in that module's spec.
 */
describe('index-html (Gauzy Server UI start page)', () => {
	const INDEX = '<html>\n<body>\n\t<ga-app></ga-app>\n</body>\n</html>\n';
	/** What desktop-lib's buildUiRuntimeConfigScript('http://127.0.0.1:3000') gives. */
	const SNIPPET = `<script>window._env = { api: "http://127.0.0.1:3000" }; if (typeof global === 'undefined') { var global = window; }</script>`;

	const request = (method: string, url: string) => ({ method, url }) as IncomingMessage;

	it('reads the variable desktop-lib’s UiService sets', () => {
		expect(UI_RUNTIME_CONFIG_SCRIPT_ENV).toBe('UI_RUNTIME_CONFIG_SCRIPT');
	});

	describe('isIndexHtmlRequest', () => {
		it.each(['/', '/index.html', '/?lang=fr', '/index.html?x=1'])(
			'GET and HEAD %s ask for the start page',
			(url) => {
				expect(isIndexHtmlRequest(request('GET', url))).toBe(true);
				expect(isIndexHtmlRequest(request('HEAD', url))).toBe(true);
			}
		);

		it.each([
			'/main.js',
			'/assets/',
			'/assets/index.html',
			'/index.html%00',
			'/../index.html',
			'/%2e%2e/index.html'
		])('GET %s is left to the static files', (url) => {
			expect(isIndexHtmlRequest(request('GET', url))).toBe(false);
		});

		it('leaves other methods to the static files (which answer 405)', () => {
			expect(isIndexHtmlRequest(request('POST', '/'))).toBe(false);
		});
	});

	describe('insertIntoIndexHtml', () => {
		it('puts the snippet on a line of its own in front of </body>, where desktop-lib writes it into the file', () => {
			expect(insertIntoIndexHtml(INDEX, SNIPPET)).toBe(
				`<html>\n<body>\n\t<ga-app></ga-app>\n${SNIPPET}\n</body>\n</html>\n`
			);
		});

		it('adds no second copy to a page that already holds it (a writable install’s file)', () => {
			const written = insertIntoIndexHtml(INDEX, SNIPPET);

			expect(insertIntoIndexHtml(written, SNIPPET)).toBe(written);
		});

		it('adds the current script after an outdated one in the file, so the current one runs last and wins', () => {
			const outdated = insertIntoIndexHtml(INDEX, SNIPPET);
			const current = SNIPPET.replace('3000', '3100');

			const html = insertIntoIndexHtml(outdated, current);

			expect(html.indexOf(current)).toBeGreaterThan(html.indexOf(SNIPPET));
		});

		it('appends the snippet to a page without </body>', () => {
			expect(insertIntoIndexHtml('<p>ui</p>', SNIPPET)).toBe(`<p>ui</p>${SNIPPET}\n`);
		});
	});
});
