import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { EmailTemplatePreviewDTO, TEMPLATE_PREVIEW_MAX_LENGTH } from './email-template-preview.dto';
import { AccountingTemplatePreviewDTO } from '../../accounting-template/dto/accounting-template-preview.dto';

/**
 * GHSA-48h9-vwf5-h8m7 — the two preview routes took an unvalidated body (`@Body('data') data:
 * string` and `@Body() input: any`), so `data` could be a JSON object (which Handlebars.compile()
 * accepts as a pre-parsed AST) and of any size. They now validate against these DTOs with the same
 * pipe options the controllers use (`whitelist: true`).
 *
 * The accepted shapes are EXACTLY what the web app sends:
 *   EmailTemplateService.generateTemplatePreview(data)        -> { data }
 *   AccountingTemplateService.generateTemplatePreview(request) -> { request: { organization, data } }
 */
describe('template preview DTOs (GHSA-48h9-vwf5-h8m7)', () => {
	const pipe = new ValidationPipe({ whitelist: true });
	const validate = (metatype: ArgumentMetadata['metatype'], value: unknown) =>
		pipe.transform(value, { type: 'body', metatype });

	const MJML = '<mjml><mj-body><mj-section><mj-column><mj-text>Hi {{name}}</mj-text></mj-column></mj-section></mj-body></mjml>';
	const AST = { type: 'Program', body: [], strip: {} };

	describe('EmailTemplatePreviewDTO', () => {
		it.each([
			['an MJML body', { data: MJML }],
			['a Handlebars subject', { data: 'Welcome {{name}}' }],
			['an empty editor', { data: '' }],
			['a template the find endpoint did not return', {}]
		])('accepts %s (what the UI sends)', async (_label, body) => {
			await expect(validate(EmailTemplatePreviewDTO, body)).resolves.toEqual(body);
		});

		it('strips unknown properties', async () => {
			await expect(validate(EmailTemplatePreviewDTO, { data: MJML, extra: 1 })).resolves.toEqual({ data: MJML });
		});

		it.each([
			['an object (Handlebars AST)', { data: AST }],
			['an array', { data: [MJML] }],
			['a number', { data: 1 }],
			['a template over the size limit', { data: 'x'.repeat(TEMPLATE_PREVIEW_MAX_LENGTH + 1) }]
		])('rejects %s', async (_label, body) => {
			await expect(validate(EmailTemplatePreviewDTO, body)).rejects.toBeInstanceOf(BadRequestException);
		});

		it('CONTROL: the pre-fix untyped body let an AST object through', async () => {
			// `@Body() input: any` reflects as Object, which ValidationPipe does not validate.
			await expect(validate(Object, { data: AST })).resolves.toEqual({ data: AST });
		});
	});

	describe('AccountingTemplatePreviewDTO', () => {
		it('accepts { request: { organization, data } } as the UI sends it', async () => {
			const body = { request: { organization: 'Acme Inc.', data: MJML } };
			await expect(validate(AccountingTemplatePreviewDTO, body)).resolves.toEqual(body);
		});

		it('accepts an empty editor', async () => {
			const body = { request: { organization: 'Acme Inc.', data: '' } };
			await expect(validate(AccountingTemplatePreviewDTO, body)).resolves.toEqual(body);
		});

		it('strips unknown properties at both levels', async () => {
			await expect(
				validate(AccountingTemplatePreviewDTO, { request: { data: MJML, organization: 'Acme', x: 1 }, y: 2 })
			).resolves.toEqual({ request: { data: MJML, organization: 'Acme' } });
		});

		it.each([
			['a missing request', {}],
			['a string request', { request: MJML }],
			['an object data (Handlebars AST)', { request: { data: AST, organization: 'Acme' } }],
			['an oversized data', { request: { data: 'x'.repeat(TEMPLATE_PREVIEW_MAX_LENGTH + 1) } }]
		])('rejects %s', async (_label, body) => {
			await expect(validate(AccountingTemplatePreviewDTO, body)).rejects.toBeInstanceOf(BadRequestException);
		});

		it('CONTROL: the pre-fix `input: any` body let an AST object through', async () => {
			const body = { request: { data: AST, organization: {} } };
			await expect(validate(Object, body)).resolves.toEqual(body);
		});
	});
});
