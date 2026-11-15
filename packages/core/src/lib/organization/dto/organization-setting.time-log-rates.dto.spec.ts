import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOrganizationDTO } from './update-organization.dto';

/**
 * Whether an organization's time logs keep the rates they were recorded at is one of its settings: an organization
 * editor turns it on or off with the rest of them, and only a boolean is taken.
 */
describe('the time logs keep their rates setting of an organization', () => {
	const errorsOf = async (value: unknown) => {
		const dto = plainToInstance(UpdateOrganizationDTO, { timeLogsKeepTheirRates: value });
		const errors = await validate(dto, { skipMissingProperties: true, whitelist: true });
		return errors.filter((error) => error.property === 'timeLogsKeepTheirRates');
	};

	it('is taken as a boolean on an organization update', async () => {
		expect(await errorsOf(true)).toEqual([]);
		expect(await errorsOf(false)).toEqual([]);

		const dto = plainToInstance(UpdateOrganizationDTO, { timeLogsKeepTheirRates: true });
		await validate(dto, { skipMissingProperties: true, whitelist: true });
		expect(dto.timeLogsKeepTheirRates).toBe(true);
	});

	it('refuses anything else', async () => {
		expect(await errorsOf('yes')).toHaveLength(1);
	});
});
