import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDTO } from '../../employee/dto/update-profile.dto';
import { OrganizationProjectRateDTO } from '../../organization-project/dto/organization-project-rate.dto';

/**
 * The day a rate applies from is a date (UTC midnight) or a date-time with its offset: a date-time without one would
 * be read in the server's own time zone, and two servers would re-price different time for the same request.
 */
describe('the day a rate change applies from', () => {
	const errorsOf = async (value: string) => {
		const profile = await validate(plainToInstance(UpdateProfileDTO, { ratesApplyFrom: value }));
		const rate = await validate(
			plainToInstance(OrganizationProjectRateDTO, {
				organizationId: 'organization-1',
				billRateValue: 50,
				applyFrom: value
			})
		);
		const profileField = profile.filter((error) => error.property === 'ratesApplyFrom');
		const rateField = rate.filter((error) => error.property === 'applyFrom');
		return [profileField.length, rateField.length];
	};

	it.each(['2026-10-01', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00.000Z', '2026-10-01T09:30:00+01:00'])(
		'takes %s',
		async (value) => {
			expect(await errorsOf(value)).toEqual([0, 0]);
		}
	);

	it.each(['2026-10-01T00:00:00', '2026-10-01T09:30'])('refuses %s, which names no offset', async (value) => {
		expect(await errorsOf(value)).toEqual([1, 1]);
	});
});
