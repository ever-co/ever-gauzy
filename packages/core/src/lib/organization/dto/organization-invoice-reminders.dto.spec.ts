/**
 * 🛑 This import must stay FIRST: the organization DTOs pick from the entity, which reaches the decorator graph.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOrganizationDTO } from './create-organization.dto';
import { UpdateOrganizationDTO } from './update-organization.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';

/**
 * The organization's switch for the payment reminders its clients get by email: a boolean, which a write may leave
 * out, and which the organization's create and update carry.
 */
describe('OrganizationSettingDTO payment reminders switch', () => {
	const invalidProperties = async (plain: Record<string, unknown>) => {
		const errors = await validate(plainToInstance(OrganizationSettingDTO, plain));
		return errors.map((error) => error.property);
	};

	it.each([true, false])('accepts %p, and a write that leaves the switch out', async (invoiceRemindersEnabled) => {
		expect(await invalidProperties({ invoiceRemindersEnabled })).toEqual([]);
		expect(await invalidProperties({})).toEqual([]);
	});

	it.each(['true', 1, 'yes'])('refuses %p', async (invoiceRemindersEnabled) => {
		expect(await invalidProperties({ invoiceRemindersEnabled })).toEqual(['invoiceRemindersEnabled']);
	});

	it.each([
		['create', CreateOrganizationDTO],
		['update', UpdateOrganizationDTO]
	])('is kept by the organization %s through the whitelist', async (_, dto) => {
		const write = plainToInstance(dto as typeof UpdateOrganizationDTO, { invoiceRemindersEnabled: true });
		const errors = await validate(write, { whitelist: true, skipMissingProperties: true });

		expect(errors.map((error) => error.property)).not.toContain('invoiceRemindersEnabled');
		expect(write.invoiceRemindersEnabled).toBe(true);
	});
});
