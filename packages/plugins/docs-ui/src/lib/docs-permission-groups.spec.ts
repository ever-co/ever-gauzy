import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DOCS_PERMISSIONS } from './docs-permission-groups';

/**
 * Regression guard for a hang that made the Documents page unusable in production.
 *
 * Clicking "Documents" in the sidebar pinned the main thread — the route never painted and Chrome
 * reported the renderer as unresponsive. A live stack sampler on the running site showed two
 * frames climbing without bound while everything else stayed flat:
 *
 *     NgxRolesService.hasOnlyRoles                     n=8 → 13 → 19 → 27 → 36 → 45 → 54 → 83
 *     NgxPermissionsDirective.validateOnlyPermissions  n=24 → 33 → 41 → 51 → 59 → 72
 *
 * Cause: every gate in this package was written `*ngxPermissionsOnly="[permissions.DOCS_X]"`. An
 * array literal in a binding is a NEW array each change-detection cycle, so the directive's
 * `ngOnChanges` fired every cycle, ran `validateOnlyPermissions()`, and resolved a `Promise.all`.
 * Under default change detection — which 47 of this package's 61 components use — that microtask
 * makes Zone schedule another application-wide tick, which rebuilds the array, which fires
 * `ngOnChanges` again. The cycle can never complete.
 *
 * Nothing else catches this: it type-checks, the Angular build is clean, and every unit test
 * passes, because the loop only exists once the directive, default change detection and a real
 * Zone are running together in a browser.
 */
describe('docs-ui permission gates never bind an array literal', () => {
	const libRoot = __dirname;

	const walk = (dir: string, acc: string[] = []): string[] => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full, acc);
			else if (/\.(html|ts)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)) acc.push(full);
		}
		return acc;
	};

	const files = walk(libRoot).filter((f) => !f.endsWith('docs-permission-groups.ts'));

	it('sweeps a non-trivial number of files (guard against a vacuous pass)', () => {
		expect(files.length).toBeGreaterThan(50);
	});

	it('has no `ngxPermissionsOnly="[...]"` anywhere — that literal is what wedged the page', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			// Matches both the structural (*ngxPermissionsOnly) and property ([ngxPermissionsOnly])
			// forms, in .html templates and inline `template:` strings alike.
			if (/ngxPermissionsOnly\]?=\s*"\s*\[/.test(source)) {
				offenders.push(file.replace(libRoot, ''));
			}
		}
		expect(offenders).toEqual([]);
	});

	it('exposes a frozen array per permission, so the reference is stable across cycles', () => {
		for (const [name, value] of Object.entries(DOCS_PERMISSIONS)) {
			expect(Array.isArray(value)).toBe(true);
			expect(value.length).toBeGreaterThan(0);
			expect(Object.isFrozen(value)).toBe(true);
			// The identity must survive repeated reads — that is the entire point.
			expect((DOCS_PERMISSIONS as Record<string, unknown>)[name]).toBe(value);
		}
		expect(Object.isFrozen(DOCS_PERMISSIONS)).toBe(true);
	});

	it('every component whose template uses docsPermissions actually declares the field', () => {
		const missing: string[] = [];
		for (const file of files) {
			if (!/docsPermissions\./.test(readFileSync(file, 'utf8'))) continue;
			const componentFile = file.endsWith('.html') ? file.replace(/\.html$/, '.ts') : file;
			const source = readFileSync(componentFile, 'utf8');
			if (!/readonly docsPermissions/.test(source)) {
				missing.push(componentFile.replace(libRoot, ''));
			}
		}
		// A template referencing an undeclared field renders the gate as "no permissions", which
		// silently hides UI rather than throwing — worth failing the build over.
		expect(missing).toEqual([]);
	});
});
