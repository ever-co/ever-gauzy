/**
 * Regression guard for the sanitizer bypass this package shipped (`08-permissions-security.md` §6).
 *
 * Every template here renders on `/public/:profile_link`, which is served to ANONYMOUS visitors.
 * `organization.component.html` bound `Employee.description` through the shared `safeHtml` pipe —
 * `bypassSecurityTrustHtml` — so editor-authored HTML stored by any tenant user executed in every
 * visitor's browser. The fix is structural (bind a sanitized plain string), and structure is what
 * this spec pins: a future template cannot quietly reintroduce a trusted-HTML binding.
 *
 * The scan is over the template SOURCE rather than a rendered fixture on purpose — the risk is a
 * new binding somewhere in ~1500 lines of markup, not a regression in the one line already fixed,
 * and a per-component TestBed would only ever cover the bindings someone remembered to exercise.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Every component template shipped by this package. */
const TEMPLATE_DIR = path.join(__dirname, 'components');

/** Recursively collects `*.component.html` paths under `dir`. */
function collectTemplates(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return collectTemplates(full);
		}
		return entry.name.endsWith('.component.html') ? [full] : [];
	});
}

/** `[innerHtml]="…"` / `[innerHTML]="…"` bindings, with their bound expression. */
const INNER_HTML_BINDING = /\[innerHTML\]\s*=\s*"([^"]*)"/gi;

describe('public-layout templates', () => {
	const templates = collectTemplates(TEMPLATE_DIR);

	it('ships templates to scan', () => {
		// A silently-empty scan is the classic false clean.
		expect(templates.length).toBeGreaterThan(0);
	});

	it.each(templates.map((file) => [path.relative(TEMPLATE_DIR, file), file]))(
		'%s never bypasses the sanitizer',
		(_name: string, file: string) => {
			const markup = fs.readFileSync(file, 'utf8');

			expect(markup).not.toContain('safeHtml');
			expect(markup).not.toContain('bypassSecurityTrust');
		}
	);

	it.each(templates.map((file) => [path.relative(TEMPLATE_DIR, file), file]))(
		'%s routes every [innerHtml] binding through the sanitizing pipe',
		(_name: string, file: string) => {
			const markup = fs.readFileSync(file, 'utf8');
			const unsanitized = [...markup.matchAll(INNER_HTML_BINDING)]
				.map((match) => match[1].trim())
				.filter((expression: string) => !/\|\s*sanitizeHtml\b/.test(expression));

			expect(unsanitized).toEqual([]);
		}
	);
});
