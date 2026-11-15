/**
 * 🛑 This import must stay FIRST: the organization DTOs pick from the entity, which reaches the decorator graph.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrganizationDTO } from './update-organization.dto';
import { OrganizationSettingDTO } from './organization-setting.dto';

/**
 * Issue #11923 — the organization's settings for discarding a running timer: the switch is a boolean, and the time
 * limit a whole number of minutes from 1 to 1440 (a day), or null for no limit.
 */
describe('OrganizationSettingDTO discard timer settings', () => {
	const invalidProperties = async (plain: Record<string, unknown>) => {
		const errors = await validate(plainToInstance(OrganizationSettingDTO, plain));
		return errors.map((error) => error.property);
	};

	it('accepts the switch off and a limit of 10 minutes', async () => {
		expect(await invalidProperties({ allowDiscardTimer: false, discardTimerWithinMinutes: 10 })).toEqual([]);
	});

	it('accepts a null limit, which removes it, and a write that sends neither setting', async () => {
		expect(await invalidProperties({ allowDiscardTimer: true, discardTimerWithinMinutes: null })).toEqual([]);
		expect(await invalidProperties({})).toEqual([]);
	});

	it.each([0, -5, 1441, 7.5, '10'])('refuses a limit of %p', async (discardTimerWithinMinutes) => {
		expect(await invalidProperties({ discardTimerWithinMinutes })).toEqual(['discardTimerWithinMinutes']);
	});

	it('refuses a switch that is not a boolean', async () => {
		expect(await invalidProperties({ allowDiscardTimer: 'no' })).toEqual(['allowDiscardTimer']);
	});

	it('carries both settings into the organization update, which keeps them through the whitelist', async () => {
		const update = plainToInstance(UpdateOrganizationDTO, {
			allowDiscardTimer: false,
			discardTimerWithinMinutes: 5
		});
		const errors = await validate(update, { whitelist: true, skipMissingProperties: true });

		expect(errors.map((error) => error.property)).not.toContain('discardTimerWithinMinutes');
		expect(update).toMatchObject({ allowDiscardTimer: false, discardTimerWithinMinutes: 5 });
	});
});
