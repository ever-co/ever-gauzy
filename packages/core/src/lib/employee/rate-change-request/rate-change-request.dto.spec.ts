import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeeRateChangeRequestDTO } from './rate-change-request.dto';

/** A rate change request names the rate asked for: a missing or null rate is refused, a rate of 0 is a real ask. */
describe('EmployeeRateChangeRequestDTO', () => {
	const ORGANIZATION = '11111111-1111-4111-8111-111111111111';

	const rateErrors = async (body: Record<string, unknown>) => {
		const dto = plainToInstance(EmployeeRateChangeRequestDTO, { organizationId: ORGANIZATION, ...body });
		const errors = await validate(dto, { skipMissingProperties: false });
		return errors.filter((error) => error.property === 'billRateValue');
	};

	it('refuses a null rate, as it refuses a missing one', async () => {
		expect(await rateErrors({ billRateValue: null })).toHaveLength(1);
		expect(await rateErrors({})).toHaveLength(1);
	});

	it('accepts a rate of 0 and a positive rate, rounded to cents', async () => {
		expect(await rateErrors({ billRateValue: 0 })).toHaveLength(0);
		expect(await rateErrors({ billRateValue: 45.5 })).toHaveLength(0);

		const dto = plainToInstance(EmployeeRateChangeRequestDTO, {
			organizationId: ORGANIZATION,
			billRateValue: 12.345
		});
		expect(dto.billRateValue).toBe(12.35);
	});
});
