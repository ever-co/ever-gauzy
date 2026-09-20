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

	it('declares no tenant field: a body can never name the tenant it writes into', () => {
		// The DTO is the schema the route whitelists against (`@UseValidationPipe({ whitelist: true })`),
		// so a field it does not declare is dropped before the handler sees it. The instance itself still
		// carries the extra key — `plainToInstance` copies unknown properties — which is why the route
		// whitelists and the controller also strips the scope fields explicitly.
		const declared = Object.keys(plainToInstance(CreateEmailTemplateDTO, VALID));
		expect(declared).not.toContain('tenantId');
		expect(declared).not.toContain('tenant');
		expect(declared.sort()).toEqual(['hbs', 'languageCode', 'mjml', 'name']);
	});
});
