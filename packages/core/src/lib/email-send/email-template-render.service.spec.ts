// cspell:ignore Здравейте Потвърдете
import { FindOperator } from 'typeorm';
import { LanguagesEnum } from '@gauzy/contracts';
import { EmailTemplateRenderService } from './email-template-render.service';
import { SMTPUtils } from './utils';

/**
 * The renderer picks a template by name + language (+ organization / tenant when the tenant has its
 * own SMTP). CC01-07: email-verification ships only in en/bg/he/ru, and every other locale rendered
 * '' for each part, so those users got no verification email at all.
 */

interface Row {
	name: string;
	languageCode: string;
	organizationId: string | null;
	tenantId: string | null;
	hbs: string;
}

/** Matches a TypeORM-style where object against a row; `IsNull()` matches null. */
function matches(row: Row, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, expected]) => {
		const actual = (row as unknown as Record<string, unknown>)[key];
		if (expected instanceof FindOperator) {
			return expected.type === 'isNull' ? actual === null || actual === undefined : false;
		}
		return actual === expected;
	});
}

function makeService(rows: Row[], smtpRow: unknown = null) {
	const lookups: Record<string, unknown>[] = [];
	const templateRepository = {
		findOneBy: jest.fn(async (where: Record<string, unknown>) => {
			lookups.push(where);
			return rows.find((row) => matches(row, where)) ?? null;
		})
	};
	const customSmtpRepository = {
		findOneOrFail: jest.fn(async () => {
			if (!smtpRow) throw new Error('not found');
			return smtpRow;
		}),
		findOne: jest.fn(async () => smtpRow)
	};
	const service = new EmailTemplateRenderService(templateRepository as any, customSmtpRepository as any);
	return { service, lookups };
}

const GLOBAL = { organizationId: null, tenantId: null };

const ROWS: Row[] = [
	{ name: 'email-verification/html', languageCode: 'en', ...GLOBAL, hbs: '<p>Hello {{name}} (en)</p>' },
	{ name: 'email-verification/subject', languageCode: 'en', ...GLOBAL, hbs: 'Verify your email (en)' },
	{ name: 'email-verification/html', languageCode: 'bg', ...GLOBAL, hbs: '<p>Здравейте {{name}} (bg)</p>' },
	{ name: 'email-verification/subject', languageCode: 'bg', ...GLOBAL, hbs: 'Потвърдете (bg)' }
];

describe('EmailTemplateRenderService locale fallback', () => {
	it('renders the recipient language when it has a template (control)', async () => {
		const { service } = makeService(ROWS);
		await expect(service.render('email-verification/html', { locale: 'bg', name: 'Ana' })).resolves.toBe(
			'<p>Здравейте Ana (bg)</p>'
		);
	});

	it('falls back to English for a locale with no template instead of rendering nothing', async () => {
		const { service } = makeService(ROWS);
		await expect(service.render('email-verification/html', { locale: 'es', name: 'Ana' })).resolves.toBe(
			'<p>Hello Ana (en)</p>'
		);
		await expect(service.render('email-verification/subject', { locale: LanguagesEnum.CHINESE })).resolves.toBe(
			'Verify your email (en)'
		);
	});

	it('uses English when no locale is given', async () => {
		const { service } = makeService(ROWS);
		await expect(service.render('email-verification/html', { name: 'Ana' })).resolves.toBe('<p>Hello Ana (en)</p>');
	});

	it('still returns empty for a view that exists in no language (the optional text part)', async () => {
		const { service, lookups } = makeService(ROWS);
		await expect(service.render('email-verification/text', { locale: 'es' })).resolves.toBe('');
		// Tried the requested language, then English - and nothing else.
		expect(lookups.map((where) => where['languageCode'])).toEqual(['es', 'en']);
	});

	describe('with a tenant that has its own (valid) SMTP', () => {
		const tenantId = 'tenant-1';
		const smtp = { getSmtpTransporter: () => ({}) };
		const rows: Row[] = [
			...ROWS,
			{
				name: 'email-verification/html',
				languageCode: 'en',
				organizationId: null,
				tenantId,
				hbs: '<p>Tenant copy (en)</p>'
			},
			{
				name: 'email-verification/html',
				languageCode: 'bg',
				organizationId: null,
				tenantId,
				hbs: '<p>Tenant copy (bg)</p>'
			}
		];

		beforeEach(() => {
			jest.spyOn(SMTPUtils, 'convertSmtpToTransporter').mockReturnValue({} as any);
			jest.spyOn(SMTPUtils, 'verifyTransporter').mockResolvedValue(true);
		});

		afterEach(() => jest.restoreAllMocks());

		it('uses the tenant copy in the recipient language', async () => {
			const { service } = makeService(rows, smtp);
			await expect(service.render('email-verification/html', { locale: 'bg', tenantId })).resolves.toBe(
				'<p>Tenant copy (bg)</p>'
			);
		});

		it('falls back to the tenant English copy before any global row', async () => {
			const { service } = makeService(rows, smtp);
			await expect(service.render('email-verification/html', { locale: 'es', tenantId })).resolves.toBe(
				'<p>Tenant copy (en)</p>'
			);
		});

		it('falls back to the global English copy when the tenant has none', async () => {
			const { service } = makeService(ROWS, smtp);
			await expect(
				service.render('email-verification/html', { locale: 'es', tenantId, name: 'Ana' })
			).resolves.toBe('<p>Hello Ana (en)</p>');
		});
	});
});
