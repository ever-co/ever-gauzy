/**
 * Importing the DTO pulls in `shared/validators`, which reaches `employee.entity` ->
 * `core/entities/internal`. Entering that cycle from this side leaves the validator decorators
 * undefined and the suite dies at import time; loading the entity graph FIRST resolves the cycle in
 * the order the application itself uses, so this side-effect import must stay above the others.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmailTemplateDTO } from './create-email-template.dto';

/**
 * `POST /email-template` is an overridden route (GHSA-44pv-34gx-q9p4): the tenant is the caller's own
 * and never read from the body. The body itself used to be undeclared, so `name`, `languageCode` and
 * `hbs` — all three `NOT NULL` on `email_template` — reached persistence unvalidated and a payload
 * missing one failed as a database error instead of a 400.
 *
 * `organizationId` is deliberately left out of every payload here: it also runs
 * `@IsOrganizationBelongsToUser()`, an async validator that reads `RequestContext` and the database,
 * and there is neither in this suite. Its membership behaviour is covered in
 * `shared/validators/constraints/organization-membership-fail-open.spec.ts`.
 */
describe('CreateEmailTemplateDTO', () => {
	const VALID = {
		name: 'welcome-user/html',
		languageCode: 'en',
		mjml: '<mjml></mjml>',
		hbs: '<p>{{name}}</p>'
	};

	const failedProperties = async (payload: Record<string, unknown>): Promise<string[]> => {
		const errors = await validate(plainToInstance(CreateEmailTemplateDTO, payload));
		return errors.map((error) => error.property).sort();
	};

	it('accepts a complete template', async () => {
		await expect(failedProperties(VALID)).resolves.toEqual([]);
	});

	it('accepts a template with no mjml, the one nullable column of the four', async () => {
		const { mjml, ...withoutMjml } = VALID;
		expect(mjml).toBeDefined();
		await expect(failedProperties(withoutMjml)).resolves.toEqual([]);
	});

	it.each(['name', 'languageCode', 'hbs'])('refuses a template with no %s', async (field) => {
		const payload: Record<string, unknown> = { ...VALID };
		delete payload[field];
		await expect(failedProperties(payload)).resolves.toEqual([field]);
	});

	it('refuses a non-string value where a string column is expected', async () => {
		await expect(failedProperties({ ...VALID, name: { id: 'x' }, hbs: 42 })).resolves.toEqual(['hbs', 'name']);
	});

	it('refuses a language code the platform does not ship', async () => {
		// Every reader looks a template up by a `LanguagesEnum` value, so `xx` would store a row nothing
		// can find. The column itself has no enum constraint, which is why the DTO carries the check.
		await expect(failedProperties({ ...VALID, languageCode: 'xx' })).resolves.toEqual(['languageCode']);
		await expect(failedProperties({ ...VALID, languageCode: 'de' })).resolves.toEqual([]);
	});

	it('declares no tenant field: a body naming one has it whitelisted away', async () => {
		// The DTO is the schema the route whitelists against (`@UseValidationPipe({ whitelist: true })`),
		// so a field it does not declare never reaches the handler. Asserted through the same
		// whitelisting `validate()` the pipe runs, with the tenant keys actually present in the input —
		// `plainToInstance` alone copies unknown properties straight onto the instance.
		const instance = plainToInstance(CreateEmailTemplateDTO, {
			...VALID,
			tenant: { id: '3f0c1d2e-0000-4000-8000-000000000001' },
			tenantId: '3f0c1d2e-0000-4000-8000-000000000001'
		});
		expect(Object.keys(instance)).toEqual(expect.arrayContaining(['tenant', 'tenantId']));

		await expect(validate(instance, { whitelist: true })).resolves.toEqual([]);

		expect(Object.keys(instance).sort()).toEqual(['hbs', 'languageCode', 'mjml', 'name']);
	});
});
