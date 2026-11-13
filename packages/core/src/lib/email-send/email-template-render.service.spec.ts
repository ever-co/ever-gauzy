// cspell:ignore Здравейте Потвърдете
import { FindOperator } from 'typeorm';
import { environment } from '@gauzy/config';
import { LanguagesEnum } from '@gauzy/contracts';
import { EmailTemplateRenderService, withDefaultBranding } from './email-template-render.service';
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

/**
 * Only some senders pass the app's branding to their template. The team invitation, the timesheet, invoice and
 * Inbox emails pass none, and their templates then printed a logo without a source and a footer without a name.
 */
describe('EmailTemplateRenderService default branding', () => {
	const DEPLOYMENT = {
		appName: 'Gauzy',
		appLogo: 'https://app.gauzy.co/assets/images/logos/logo_Gauzy.png',
		appSignature: 'Gauzy Team',
		appLink: 'https://app.gauzy.co/',
		appEmailConfirmationUrl: 'https://app.gauzy.co/#/auth/confirm-email',
		appMagicSignUrl: 'https://app.gauzy.co/#/auth/magic-sign-in',
		companyLink: 'https://ever.co',
		companyName: 'Ever Co. LTD'
	};
	const BRANDED: Row[] = [
		{
			name: 'invite-gauzy-teams/html',
			languageCode: 'en',
			...GLOBAL,
			hbs: '<img src="{{appLogo}}" alt="{{appName}}"><p>{{teams}}</p><p>{{appSignature}}</p><a href="{{appLink}}">{{appName}}</a> <a href="{{companyLink}}">{{companyName}}</a>'
		},
		{ name: 'invite-gauzy-teams/subject', languageCode: 'en', ...GLOBAL, hbs: 'Join {{teams}} on {{appName}}' }
	];

	beforeEach(() => {
		jest.replaceProperty(environment, 'appIntegrationConfig', DEPLOYMENT);
	});

	afterEach(() => jest.restoreAllMocks());

	it('prints the deployment branding in an email whose sender passes none', async () => {
		const { service } = makeService(BRANDED);

		await expect(service.render('invite-gauzy-teams/html', { teams: 'Web' })).resolves.toBe(
			'<img src="https://app.gauzy.co/assets/images/logos/logo_Gauzy.png" alt="Gauzy"><p>Web</p><p>Gauzy Team</p>' +
				'<a href="https://app.gauzy.co/">Gauzy</a> <a href="https://ever.co">Ever Co. LTD</a>'
		);
		await expect(service.render('invite-gauzy-teams/subject', { teams: 'Web' })).resolves.toBe('Join Web on Gauzy');
	});

	it('keeps the branding a sender passes, and fills only what it left out', async () => {
		const { service } = makeService(BRANDED);
		const locals = {
			teams: 'Web',
			appName: 'Ever Teams',
			appLogo: 'https://app.ever.team/assets/ever-teams.png',
			appSignature: 'Ever Teams',
			appLink: 'https://app.ever.team/'
		};

		await expect(service.render('invite-gauzy-teams/html', locals)).resolves.toBe(
			'<img src="https://app.ever.team/assets/ever-teams.png" alt="Ever Teams"><p>Web</p><p>Ever Teams</p>' +
				'<a href="https://app.ever.team/">Ever Teams</a> <a href="https://ever.co">Ever Co. LTD</a>'
		);
	});

	it('takes a blank value for one the sender left out', () => {
		const filled = withDefaultBranding({ appName: '', appLogo: null, appSignature: undefined, appLink: '  ' });

		expect(filled.appName).toBe('Gauzy');
		expect(filled.appLogo).toBe(DEPLOYMENT.appLogo);
		expect(filled.appSignature).toBe('Gauzy Team');
		expect(filled.appLink).toBe(DEPLOYMENT.appLink);
	});

	it('adds only branding, and leaves the locals it was given untouched', () => {
		const locals = { teams: 'Web', appName: 'Ever Teams' };
		const filled = withDefaultBranding(locals);

		expect(locals).toEqual({ teams: 'Web', appName: 'Ever Teams' });
		expect(Object.keys(filled).sort()).toEqual(
			['appLink', 'appLogo', 'appName', 'appSignature', 'companyLink', 'companyName', 'teams'].sort()
		);
		// The links an email is built on are the sender's to decide, never filled in here.
		expect(filled).not.toHaveProperty('appMagicSignUrl');
		expect(filled).not.toHaveProperty('appEmailConfirmationUrl');
	});

	it('fills nothing the deployment does not configure', () => {
		jest.replaceProperty(environment, 'appIntegrationConfig', { appName: 'Gauzy' });

		expect(withDefaultBranding({ teams: 'Web' })).toEqual({ teams: 'Web', appName: 'Gauzy' });
	});
});
