import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as Handlebars from 'handlebars';
// eslint-disable-next-line no-restricted-imports -- CONTROL arm only: the pre-fix compiler call
import * as rawMjml2html from 'mjml';
import { EmailTemplateGeneratePreviewQuery } from '../email-template.generate-preview.query';

import * as compileMjmlModule from '../../compile-mjml';
import { EmailTemplateGeneratePreviewHandler } from './email-template.generate-preview.handler';

/**
 * GHSA-48h9-vwf5-h8m7 — `POST /email-template/template/preview` compiled the caller's MJML with
 * includes enabled and returned the included file's bytes. The handler must compile through
 * compileMjml(); the CONTROL swaps in the pre-fix `mjml2html(input)` call to show the same request
 * would leak through this handler.
 */
describe('EmailTemplateGeneratePreviewHandler (GHSA-48h9-vwf5-h8m7)', () => {
	const MARKER = `PREVIEW-LFI-${process.pid}-${Date.now()}`;
	let dir: string;
	let secretFile: string;
	let handler: EmailTemplateGeneratePreviewHandler;

	const payload = () =>
		`<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{name}}</mj-text><mj-include path="${secretFile}" type="html" /></mj-column></mj-section></mj-body></mjml>`;

	beforeAll(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauzy-preview-'));
		secretFile = path.join(dir, 'environ');
		fs.writeFileSync(secretFile, `DB_PASS=${MARKER}`);
	});

	afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

	beforeEach(() => {
		handler = new EmailTemplateGeneratePreviewHandler({ get: () => 'http://localhost:4200' } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not return the bytes of an <mj-include>d file', async () => {
		const compile = jest.spyOn(compileMjmlModule, 'compileMjml');
		const { html } = await handler.execute(new EmailTemplateGeneratePreviewQuery(payload()));

		expect(html).not.toContain(MARKER);
		expect(html).toContain('Hello John Doe');
		expect(compile).toHaveBeenCalledTimes(1);
	});

	it('CONTROL: with the pre-fix compiler call the same request leaks the file', async () => {
		jest.spyOn(compileMjmlModule, 'compileMjml').mockImplementation((source: unknown) => rawMjml2html(source));

		const { html } = await handler.execute(new EmailTemplateGeneratePreviewQuery(payload()));

		expect(html).toContain(MARKER);
	});

	it('still renders plain MJML and Handlebars subjects', async () => {
		const mjml = await handler.execute(
			new EmailTemplateGeneratePreviewQuery(
				'<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{name}}</mj-text></mj-column></mj-section></mj-body></mjml>'
			)
		);
		expect(mjml.html).toContain('Hello John Doe');

		// A subject is not MJML: mjml reports errors and the raw text is rendered by Handlebars.
		const subject = await handler.execute(new EmailTemplateGeneratePreviewQuery('Welcome {{name}}'));
		expect(subject.html).toBe('Welcome John Doe');
	});

	it('renders an empty or missing template as empty html instead of throwing', async () => {
		expect((await handler.execute(new EmailTemplateGeneratePreviewQuery(''))).html).toBe('');
		expect((await handler.execute(new EmailTemplateGeneratePreviewQuery(undefined as any))).html).toBe('');
	});

	it('treats a JSON object body as text, never as a Handlebars AST', async () => {
		const ast = Handlebars.parse('AST-MARKER {{name}}');
		// CONTROL: Handlebars would have compiled the object as a program.
		expect(Handlebars.compile(ast as any)({ name: 'John Doe' })).toBe('AST-MARKER John Doe');

		const { html } = await handler.execute(new EmailTemplateGeneratePreviewQuery(ast as any));
		expect(html).not.toContain('AST-MARKER');
	});
});
