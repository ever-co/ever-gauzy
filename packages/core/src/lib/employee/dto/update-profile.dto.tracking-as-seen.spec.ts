/**
 * 🛑 This import must stay FIRST: the DTOs below pick members of entities, and the entity graph has to finish
 * initializing before they do.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmployeeDTO } from './update-employee.dto';
import { UpdateProfileDTO } from './update-profile.dto';

/**
 * A save can name the tracking switch its screen showed (`expectedIsTrackingEnabled`), and the API refuses it when the
 * stored one differs (ever-co/ever-gauzy#11830). Both routes that save an employee keep the flag through their
 * whitelist: `PUT /employee/:id` and `PUT /employee/:id/profile`, whose work dates can switch tracking too.
 *
 * Read off the flag's own result: the DTOs require other members these bodies do not send.
 */
describe.each([
	['PUT /employee/:id/profile', UpdateProfileDTO],
	['PUT /employee/:id', UpdateEmployeeDTO]
])('%s — the tracking switch the screen showed', (_route, dto) => {
	/** The body as the route's whitelist leaves it, and the errors on the flag. */
	const whitelisted = async (body: Record<string, unknown>) => {
		const instance = plainToInstance(dto as never, body) as Record<string, unknown>;
		const errors = await validate(instance as object, { whitelist: true });
		const flagErrors = errors.filter((error) => error.property === 'expectedIsTrackingEnabled');
		return { instance, flagErrors };
	};

	it('keeps the flag the save sends', async () => {
		const { instance, flagErrors } = await whitelisted({ expectedIsTrackingEnabled: true });

		expect(instance.expectedIsTrackingEnabled).toBe(true);
		expect(flagErrors).toEqual([]);
	});

	it('refuses a flag that is not a boolean', async () => {
		const { flagErrors } = await whitelisted({ expectedIsTrackingEnabled: 'yes' });

		expect(flagErrors).toHaveLength(1);
	});
});
