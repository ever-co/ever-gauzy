import * as vm from 'node:vm';
import { applyUiRuntimeConfig, buildUiRuntimeConfigScript, UI_RUNTIME_CONFIG_SCRIPT_ENV } from './ui-runtime-config';

/**
 * The web UI that Gauzy Server serves reads its API URL from `window._env.api`. The script setting it used to be
 * written into the install directory's `index.html` only, which a .deb (root-owned `/opt`) or an AppImage (read-only
 * mount) does not allow (#7735); the UI server now inserts it as it serves the page, and the file keeps it where the
 * directory is writable.
 */
describe('UI runtime config', () => {
	const INDEX = [
		'<!doctype html>',
		'<html lang="en">',
		'<head><base href="./"></head>',
		'<body>',
		'\t<ga-app></ga-app>',
		'\t<script src="main.js" type="module"></script>',
		'</body>',
		'</html>',
		''
	].join('\n');

	/** What the releases before this one wrote in front of `</body>` (ServerConfig's `_initialConfig`). */
	const legacyConfig = (url: string) =>
		`\n\t\t<script> window._env = { api: '${url}' };\n\t\tif (typeof global === "undefined") {\n\t\t\tvar global = window;\n\t\t}; </script>\n`;

	/** The `window` the scripts of `html` leave behind, run in order the way a browser runs inline scripts. */
	const runInlineScripts = (html: string) => {
		const window: { _env?: { api: string } } = {};
		const context = vm.createContext({ window });
		for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
			vm.runInContext(body, context);
		}
		return { window, context };
	};

	const count = (text: string, part: string) => text.split(part).length - 1;

	it('hands the script over in the variable the UI server reads', () => {
		// Pinned in apps/server/src/preload/index-html.spec.ts too: that process cannot load this package.
		expect(UI_RUNTIME_CONFIG_SCRIPT_ENV).toBe('UI_RUNTIME_CONFIG_SCRIPT');
	});

	describe('buildUiRuntimeConfigScript', () => {
		it('sets window._env.api to the API URL and defines `global` for the browser', () => {
			const script = buildUiRuntimeConfigScript('http://127.0.0.1:3000');

			expect(script).toBe(
				`<script>window._env = { api: "http://127.0.0.1:3000" }; if (typeof global === 'undefined') { var global = window; }</script>`
			);
			const { window, context } = runInlineScripts(script);
			expect(window._env).toEqual({ api: 'http://127.0.0.1:3000' });
			expect(vm.runInContext('global === window', context)).toBe(true);
		});

		it('adds http:// to a URL stored without a scheme, and keeps https://', () => {
			expect(runInlineScripts(buildUiRuntimeConfigScript('192.168.1.20:3000')).window._env.api).toBe(
				'http://192.168.1.20:3000'
			);
			expect(runInlineScripts(buildUiRuntimeConfigScript('https://gauzy.lan:3000')).window._env.api).toBe(
				'https://gauzy.lan:3000'
			);
		});

		it('keeps a URL with quotes or a closing script tag inside the string', () => {
			const url = `http://host/'"</script><script>window.hacked=1</script><!--`;

			const script = buildUiRuntimeConfigScript(url);

			// The only `</script>` is the script's own: nothing after the URL can run as another script.
			expect(count(script, '</script>')).toBe(1);
			expect(script).not.toContain('<!--');
			const { window } = runInlineScripts(script);
			expect(window._env.api).toBe(url);
			expect(window).not.toHaveProperty('hacked');
		});
	});

	describe('applyUiRuntimeConfig', () => {
		it('puts the script in front of </body> of a page that has none', () => {
			const html = applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3000');

			expect(html).toBe(
				INDEX.replace('</body>', `${buildUiRuntimeConfigScript('http://127.0.0.1:3000')}\n</body>`)
			);
			expect(runInlineScripts(html).window._env.api).toBe('http://127.0.0.1:3000');
		});

		it('replaces what an earlier release wrote, duplicates included, with one current script', () => {
			const written = INDEX.replace(
				'</body>',
				`${legacyConfig('http://127.0.0.1:3000')}${legacyConfig('http://127.0.0.1:3000')}</body>`
			);

			const html = applyUiRuntimeConfig(written, 'http://192.168.1.20:3000');

			expect(count(html, 'window._env')).toBe(1);
			expect(html).not.toContain('127.0.0.1');
			expect(html).toContain('<script src="main.js" type="module"></script>');
			expect(runInlineScripts(html).window._env.api).toBe('http://192.168.1.20:3000');
		});

		it('gives the same page when applied again, so an unchanged URL does not rewrite the file', () => {
			const once = applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3000');
			const fromLegacy = applyUiRuntimeConfig(
				INDEX.replace('</body>', `${legacyConfig('http://127.0.0.1:3000')}</body>`),
				'http://127.0.0.1:3000'
			);

			expect(applyUiRuntimeConfig(once, 'http://127.0.0.1:3000')).toBe(once);
			expect(applyUiRuntimeConfig(fromLegacy, 'http://127.0.0.1:3000')).toBe(fromLegacy);
		});

		it('follows a changed URL', () => {
			const before = applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3000');

			const after = applyUiRuntimeConfig(before, 'http://127.0.0.1:3100');

			expect(after).toBe(applyUiRuntimeConfig(INDEX, 'http://127.0.0.1:3100'));
		});

		it('leaves the page’s other inline scripts alone', () => {
			const page = INDEX.replace('<body>', '<body>\n\t<script>window.theme = "dark";</script>');

			const html = applyUiRuntimeConfig(page, 'http://127.0.0.1:3000');

			expect(html).toContain('<script>window.theme = "dark";</script>');
		});

		it('appends the script to a document without </body>', () => {
			const html = applyUiRuntimeConfig('<p>ui</p>\n', 'http://127.0.0.1:3000');

			expect(html).toBe(`<p>ui</p>\n${buildUiRuntimeConfigScript('http://127.0.0.1:3000')}\n`);
			expect(applyUiRuntimeConfig(html, 'http://127.0.0.1:3000')).toBe(html);
		});
	});
});
