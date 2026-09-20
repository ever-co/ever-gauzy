import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as Handlebars from 'handlebars';
// The CONTROL arms need the raw compiler with its defaults; production code must not import it
// (see packages/core/eslint.config.js).
// eslint-disable-next-line no-restricted-imports
import * as rawMjml2html from 'mjml';
import { compileMjml, SAFE_MJML_OPTIONS, toTemplateSource } from './compile-mjml';

/**
 * Regression suite for GHSA-48h9-vwf5-h8m7 — MJML `<mj-include>` local file inclusion.
 *
 * A tenant-editable template (or a preview request) could carry `<mj-include path="/etc/passwd"
 * type="html"/>`; mjml's defaults read that file and inline it into the HTML the API returned. Each
 * case below writes a file holding a unique marker, includes it, and asserts the marker does NOT
 * reach the output of compileMjml(). Each is paired with a CONTROL that runs the pre-fix call shape
 * (`mjml2html(source)`, no options) on the same input and shows the marker DOES leak — proving the
 * test can tell the two apart.
 */
describe('compileMjml (GHSA-48h9-vwf5-h8m7)', () => {
	let dir: string;
	const MARKER = `LFI-MARKER-${process.pid}-${Date.now()}`;

	const files: Record<'html' | 'css' | 'mjml', string> = { html: '', css: '', mjml: '' };

	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-mjml-include-'));
		files.html = path.join(dir, 'secret.html');
		files.css = path.join(dir, 'secret.css');
		files.mjml = path.join(dir, 'secret.mjml');
		fs.writeFileSync(files.html, `<p>${MARKER}</p>`);
		fs.writeFileSync(files.css, `.x { content: "${MARKER}"; }`);
		// A valid MJML fragment, so the default-type include would really render it (a non-MJML file
		// might be dropped by the parser anyway, which would make the assertion pass trivially).
		fs.writeFileSync(
			files.mjml,
			`<mj-section><mj-column><mj-text>${MARKER}</mj-text></mj-column></mj-section>`
		);
	});

	afterAll(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	const includeInColumn = (file: string, type: 'html' | 'css') =>
		`<mjml><mj-head>${
			type === 'css' ? `<mj-include path="${file}" type="css" />` : ''
		}</mj-head><mj-body><mj-section><mj-column><mj-text>Hello</mj-text>${
			type === 'html' ? `<mj-include path="${file}" type="html" />` : ''
		}</mj-column></mj-section></mj-body></mjml>`;

	const cases: Array<{ name: string; source: () => string }> = [
		{ name: 'type="html"', source: () => includeInColumn(files.html, 'html') },
		{ name: 'type="css"', source: () => includeInColumn(files.css, 'css') },
		{
			name: 'default (mjml) type',
			source: () => `<mjml><mj-body><mj-include path="${files.mjml}" /></mj-body></mjml>`
		},
		{
			name: 'URI-encoded path',
			source: () =>
				`<mjml><mj-body><mj-section><mj-column><mj-include path="${encodeURIComponent(
					files.html
				)}" type="html" /></mj-column></mj-section></mj-body></mjml>`
		}
	];

	describe.each(cases)('<mj-include> $name', ({ source }) => {
		it('does not read the included file', () => {
			const { html } = compileMjml(source());
			expect(html).not.toContain(MARKER);
		});

		it('CONTROL: the pre-fix call (mjml defaults) does read it', () => {
			const { html } = rawMjml2html(source());
			expect(html).toContain(MARKER);
		});
	});

	it('does not read a file named by a relative path either (resolved against the API cwd)', () => {
		const relative = path.relative(process.cwd(), files.html);
		const source = `<mjml><mj-body><mj-section><mj-column><mj-include path="${relative}" type="html" /></mj-column></mj-section></mj-body></mjml>`;

		expect(compileMjml(source).html).not.toContain(MARKER);
		// CONTROL
		expect(rawMjml2html(source).html).toContain(MARKER);
	});

	it('still compiles ordinary MJML exactly like before', () => {
		const source =
			'<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{name}}</mj-text></mj-column></mj-section></mj-body></mjml>';
		const result = compileMjml(source);

		expect(result.errors).toEqual([]);
		expect(result.html).toContain('Hello {{name}}');
		// Without includes the output is byte-identical to the pre-fix default compile.
		expect(result.html).toBe(rawMjml2html(source).html);
		expect(Handlebars.compile(result.html)({ name: 'John Doe' })).toContain('Hello John Doe');
	});

	it('keeps the soft validation level (invalid markup still produces html plus errors)', () => {
		expect(SAFE_MJML_OPTIONS.validationLevel).toBe('soft');

		const result = compileMjml(
			'<mjml><mj-body><mj-section><mj-column><mj-text unknown-attr="1">x</mj-text></mj-column></mj-section></mj-body></mjml>'
		);
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.html).toContain('x');
	});

	it('shipped seed templates compile to the same html as before', () => {
		const seedRoot = path.join(__dirname, '..', 'core', 'seeds', 'data');
		const templates: string[] = [];
		const walk = (folder: string) => {
			for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
				const full = path.join(folder, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (entry.name.endsWith('.mjml')) templates.push(full);
			}
		};
		walk(path.join(seedRoot, 'default-email-templates'));
		walk(path.join(seedRoot, 'default-accounting-templates'));

		// Sample: enough to cover both template families without compiling every language.
		const sample = templates.filter((file) => /[\\/]en[\\/]/.test(file)).slice(0, 25);
		expect(sample.length).toBeGreaterThan(0);

		for (const file of sample) {
			const source = fs.readFileSync(file, 'utf8');
			expect(compileMjml(source).html).toBe(rawMjml2html(source).html);
		}
	});
});

describe('toTemplateSource', () => {
	it('passes strings through and maps null/undefined to an empty string', () => {
		expect(toTemplateSource('<mjml></mjml>')).toBe('<mjml></mjml>');
		expect(toTemplateSource('')).toBe('');
		expect(toTemplateSource(null)).toBe('');
		expect(toTemplateSource(undefined)).toBe('');
	});

	it('never hands Handlebars a pre-parsed AST object', () => {
		const ast = Handlebars.parse('AST-MARKER {{name}}');

		// CONTROL: Handlebars.compile() accepts a Program AST object as a template.
		expect(Handlebars.compile(ast as any)({ name: 'x' })).toBe('AST-MARKER x');

		// After coercion it is plain text, not a template program.
		const source = toTemplateSource(ast);
		expect(typeof source).toBe('string');
		expect(Handlebars.compile(source)({ name: 'x' })).toBe('[object Object]');
	});
});
