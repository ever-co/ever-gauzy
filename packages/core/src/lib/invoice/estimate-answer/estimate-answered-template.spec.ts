// Must stay first: the entities barrel resolves the circular entity imports.
import '../../core/entities/internal';

import * as fs from 'fs';
import * as path from 'path';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { compileMjml } from '../../email-template/compile-mjml';
import { EmailService } from '../../email-send/email.service';

const TEMPLATE_FOLDER = path.join(
	__dirname,
	'..',
	'..',
	'core',
	'seeds',
	'data',
	'default-email-templates',
	'estimate-answered'
);
const LANGUAGES = ['en', 'bg', 'he', 'ru'];

/** The variables a Handlebars source reads: `{{x}}`, `{{{x}}}` and the subject of `{{#if x}}`. */
function variablesOf(source: string): string[] {
	const read = new Set<string>();
	for (const [, name] of source.matchAll(/\{\{\{?\s*(?:#if\s+|#unless\s+)?([A-Za-z_]\w*)\s*\}?\}\}/g)) {
		if (name !== 'else') {
			read.add(name);
		}
	}
	return [...read].sort();
}

/** The locals `EmailService.sendEstimateAnswered` hands the template. */
async function localsTheSenderPasses(): Promise<string[]> {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);
	const send = jest.fn(async () => ({ originalMessage: {} }));
	const service = new EmailService(
		{ save: jest.fn() } as any,
		{ findOneBy: jest.fn() } as any,
		{ findOneBy: jest.fn() } as any,
		{ getEmailInstance: jest.fn(async () => ({ send })) } as any
	);
	await service.sendEstimateAnswered({
		languageCode: LanguagesEnum.ENGLISH,
		email: 'creator@org.test',
		organization: { id: 'org-1', tenantId: 'tenant-1', name: 'Ever Org' } as any,
		invoiceId: 'estimate-1',
		invoiceNumber: 12,
		isAccepted: true
	});
	return Object.keys((send.mock.calls[0] as any[])[0].locals);
}

/**
 * `estimate-answered`, to the team member who created an estimate once the client answered it: the template, in every
 * language it ships in, compiles cleanly and reads what its sender passes, and nothing else.
 */
describe('the estimate-answered email template', () => {
	let passed: string[];

	beforeAll(async () => {
		passed = await localsTheSenderPasses();
	});

	afterAll(() => jest.restoreAllMocks());

	it('ships in every language of the other business emails', () => {
		expect(fs.readdirSync(TEMPLATE_FOLDER).sort()).toEqual([...LANGUAGES].sort());
	});

	it.each(LANGUAGES)('compiles in %s without an MJML error', async (language) => {
		const source = fs.readFileSync(path.join(TEMPLATE_FOLDER, language, 'html.mjml'), 'utf8');

		const { errors } = await compileMjml(source);

		expect(errors).toEqual([]);
	});

	it.each(LANGUAGES)('reads in %s only what the sender passes, and every part of the answer', (language) => {
		const html = fs.readFileSync(path.join(TEMPLATE_FOLDER, language, 'html.mjml'), 'utf8');
		const subject = fs.readFileSync(path.join(TEMPLATE_FOLDER, language, 'subject.hbs'), 'utf8');

		const read = variablesOf(html + subject);

		expect(read.filter((name) => !passed.includes(name))).toEqual([]);
		expect(read).toEqual(
			expect.arrayContaining([
				'isAccepted',
				'isConverted',
				'invoiceNumber',
				'contactName',
				'contactEmail',
				'amount',
				'currency',
				'estimateUrl',
				'invoiceUrl',
				'organizationName'
			])
		);
	});
});
