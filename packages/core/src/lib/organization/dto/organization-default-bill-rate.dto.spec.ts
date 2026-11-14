/**
 * 🛑 This import must stay FIRST: the organization DTOs pick from the entity, which reaches the decorator graph.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BILLING_RATE_MAX } from '../../shared/pipes';
import { UpdateOrganizationDTO } from './update-organization.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';

/**
 * Issue #11919: the organization's default billing rate is validated like a member's billing rate (a number up to
 * the rate column's maximum, kept to the cent, its currency one of the currencies), and null clears it.
 */
describe('OrganizationSettingDTO default billing rate', () => {
	const invalidProperties = async (plain: Record<string, unknown>) => {
		const errors = await validate(plainToInstance(OrganizationSettingDTO, plain));
		return errors.map((error) => error.property);
	};

	it('accepts a default of 80 EUR', async () => {
		expect(await invalidProperties({ defaultBillRateValue: 80, defaultBillRateCurrency: 'EUR' })).toEqual([]);
	});

	it('accepts nulls, which clear the default, and a write that sends neither', async () => {
		expect(await invalidProperties({ defaultBillRateValue: null, defaultBillRateCurrency: null })).toEqual([]);
		expect(await invalidProperties({})).toEqual([]);
	});

	it('keeps null as null instead of reading it as a rate of 0, and the cents of a rate', async () => {
		const cleared = plainToInstance(OrganizationSettingDTO, { defaultBillRateValue: null });
		const priced = plainToInstance(OrganizationSettingDTO, { defaultBillRateValue: 80.456 });

		expect(cleared.defaultBillRateValue).toBeNull();
		expect(priced.defaultBillRateValue).toBe(80.46);
	});

	it.each(['eighty', BILLING_RATE_MAX + 1])('refuses a default rate of %p', async (defaultBillRateValue) => {
		expect(await invalidProperties({ defaultBillRateValue })).toEqual(['defaultBillRateValue']);
	});

	it('refuses a currency that is not one of the currencies', async () => {
		expect(await invalidProperties({ defaultBillRateCurrency: 'EURO' })).toEqual(['defaultBillRateCurrency']);
	});

	it('carries both fields into the organization update, which keeps them through the whitelist', async () => {
		const update = plainToInstance(UpdateOrganizationDTO, {
			defaultBillRateValue: 80,
			defaultBillRateCurrency: 'EUR'
		});
		const errors = await validate(update, { whitelist: true, skipMissingProperties: true });

		expect(errors.map((error) => error.property)).not.toContain('defaultBillRateValue');
		expect(update).toMatchObject({ defaultBillRateValue: 80, defaultBillRateCurrency: 'EUR' });
	});
});
