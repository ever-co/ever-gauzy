import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Electron makes every element whose computed `-webkit-app-region` is `drag` part of the window's title bar: the
 * operating system moves the window on a press there, and the page never receives the click.
 *
 * Since Electron 44 (Chromium 152) the property is inherited. The time tracker's `::ng-deep body { -webkit-app-region:
 * drag }` (there since 2021) then reached every element of the timer window: the timer rendered and ran, but no
 * button, dropdown or menu in it reacted to the mouse, while the tray menu and the settings window still worked
 * (desktop timer 111.71.1, and 111.131.1 to 111.136.3). Up to Electron 38 the rule did nothing, because custom-electron-titlebar
 * moves the page into an absolutely positioned `.cet-container` and leaves `body` 0 px high.
 *
 * A drag region belongs on the element meant to move the window (a title bar, a handle), never on `body`, `html` or
 * `:root`, where it covers the whole window.
 */

const LIB_ROOT = __dirname;

/** Every stylesheet of the library (component styles, partials). */
function stylesheets(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return name === 'node_modules' ? [] : stylesheets(path);
		}
		return /\.(s?css)$/.test(name) ? [path] : [];
	});
}

/**
 * The selectors (nesting joined with spaces) of the blocks of a stylesheet that declare `app-region: drag`.
 * A small brace scanner, enough for the SCSS of this library: comments and `#{}` interpolations are dropped first.
 */
function dragRegionSelectors(source: string): string[] {
	const text = source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:])\/\/.*$/gm, '$1')
		.replace(/#\{[^}]*\}/g, 'x');
	const selectors: string[] = [];
	const found: string[] = [];
	let buffer = '';
	const declaration = () => {
		if (/(^|[\s;])(-webkit-)?app-region\s*:\s*drag\b/.test(buffer)) {
			found.push(selectors.join(' '));
		}
		buffer = '';
	};
	for (const char of text) {
		if (char === '{') {
			selectors.push(buffer.trim());
			buffer = '';
		} else if (char === '}') {
			declaration();
			selectors.pop();
		} else if (char === ';') {
			declaration();
		} else {
			buffer += char;
		}
	}
	return found;
}

/** Whether a selector matches the whole document: `body`, `html` or `:root` (not `nb-card-body`, `.body`). */
function coversWholeWindow(selector: string): boolean {
	return /(^|[\s>+~,(])(html|body)(?![\w-])|:root(?![\w-])/.test(selector);
}

describe('window drag regions', () => {
	describe('the stylesheet scan', () => {
		it('finds the rule that made the whole timer window a drag handle', () => {
			const shipped = '::ng-deep body {\n  overflow: hidden !important;\n  -webkit-app-region: drag;\n}';
			const selectors = dragRegionSelectors(shipped);
			expect(selectors).toEqual(['::ng-deep body']);
			expect(selectors.every(coversWholeWindow)).toBe(true);
		});

		it('also finds it on html, :root, or a body with a class, nested or as the last declaration', () => {
			const sources = [
				'html { app-region: drag }',
				':root { -webkit-app-region:drag; }',
				':host { ::ng-deep body.dark { color: red; -webkit-app-region: drag } }'
			];
			for (const source of sources) {
				const selectors = dragRegionSelectors(source);
				expect(selectors).toHaveLength(1);
				expect(coversWholeWindow(selectors[0])).toBe(true);
			}
		});

		it('accepts drag regions on the elements meant to move a window, and no-drag anywhere', () => {
			const source = `
				// body { -webkit-app-region: drag; }
				.main { -webkit-app-region: drag; .timer-#{$size} { color: red; } }
				nb-card-body.handle { -webkit-app-region: drag; }
				.body { -webkit-app-region: drag; }
				body { -webkit-app-region: no-drag; overflow: hidden; }
				button { -webkit-app-region: no-drag; }
			`;
			const selectors = dragRegionSelectors(source);
			expect(selectors).toEqual(['.main', 'nb-card-body.handle', '.body']);
			expect(selectors.some(coversWholeWindow)).toBe(false);
		});
	});

	it('no stylesheet of the library turns the whole window into a drag region', () => {
		const files = stylesheets(LIB_ROOT);
		const scanned = files.map((file) => relative(LIB_ROOT, file).replace(/\\/g, '/'));
		// The two stylesheets that carried the rule are part of the scan.
		expect(scanned).toEqual(
			expect.arrayContaining([
				'time-tracker/time-tracker.component.scss',
				'image-viewer/image-viewer.component.scss'
			])
		);

		const offenders = files.flatMap((file) =>
			dragRegionSelectors(readFileSync(file, 'utf8'))
				.filter(coversWholeWindow)
				.map((selector) => `${relative(LIB_ROOT, file).replace(/\\/g, '/')}: ${selector}`)
		);
		expect(offenders).toEqual([]);
	});
});
