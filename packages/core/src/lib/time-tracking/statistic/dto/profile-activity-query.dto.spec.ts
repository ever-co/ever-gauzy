import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ProfileActivityQueryDTO } from './profile-activity-query.dto';

const VALID_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const VALID_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000002';
const VALID_TEAM_ID = '00000000-0000-4000-8000-000000000003';

const validPayload = {
	organizationId: VALID_ORGANIZATION_ID,
	employeeId: VALID_EMPLOYEE_ID,
	startDate: '2024-03-10',
	endDate: '2024-03-11',
	timeZone: 'America/New_York'
};

async function validatePayload(
	overrides: Record<string, unknown> = {},
	options: Parameters<typeof validate>[1] = undefined
): Promise<{ dto: ProfileActivityQueryDTO; errors: ValidationError[] }> {
	const dto = plainToInstance(ProfileActivityQueryDTO, { ...validPayload, ...overrides });
	const errors = await validate(dto, options);

	return { dto, errors };
}

function hasError(errors: ValidationError[], property: string): boolean {
	return errors.some((error) => error.property === property);
}

describe('ProfileActivityQueryDTO', () => {
	it('accepts the required profile activity query and defaults daily output off', async () => {
		const { dto, errors } = await validatePayload();

		expect(errors).toHaveLength(0);
		expect(dto.includeDaily).toBe(false);
	});

	it.each([
		['organizationId', undefined],
		['organizationId', 'not-a-uuid'],
		['employeeId', undefined],
		['employeeId', 'not-a-uuid'],
		['organizationTeamId', 'not-a-uuid']
	])('rejects %s when its UUID value is %p', async (property, value) => {
		const { errors } = await validatePayload({ [property]: value });

		expect(hasError(errors, property)).toBe(true);
	});

	it('accepts an optional organization team UUID', async () => {
		const { errors } = await validatePayload({ organizationTeamId: VALID_TEAM_ID });

		expect(errors).toHaveLength(0);
	});

	it.each([
		['startDate', '2024-03-10T00:00:00.000Z'],
		['endDate', '2024-03-11T00:00:00.000Z'],
		['startDate', '2024-02-30'],
		['endDate', '2023-02-29'],
		['startDate', '2024-2-09']
	])('rejects non-calendar %s value %p', async (property, value) => {
		const { errors } = await validatePayload({ [property]: value });

		expect(hasError(errors, property)).toBe(true);
	});

	it('accepts a valid leap-day calendar date', async () => {
		const { errors } = await validatePayload({ startDate: '2024-02-29', endDate: '2024-03-01' });

		expect(errors).toHaveLength(0);
	});

	it('rejects an unknown IANA time zone', async () => {
		const { errors } = await validatePayload({ timeZone: 'Mars/Olympus_Mons' });

		expect(hasError(errors, 'timeZone')).toBe(true);
	});

	it.each([
		['2024-03-10', '2024-03-10'],
		['2024-03-11', '2024-03-10']
	])('rejects a non-increasing range from %s through %s', async (startDate, endDate) => {
		const { errors } = await validatePayload({ startDate, endDate });

		expect(hasError(errors, 'endDate')).toBe(true);
	});

	it('accepts an exact 366-day half-open local calendar span across DST changes', async () => {
		const { errors } = await validatePayload({ startDate: '2024-03-10', endDate: '2025-03-11' });

		expect(errors).toHaveLength(0);
	});

	it('rejects a 367-day half-open local calendar span across DST changes', async () => {
		const { errors } = await validatePayload({ startDate: '2024-03-10', endDate: '2025-03-12' });

		expect(hasError(errors, 'endDate')).toBe(true);
	});

	it('accepts an exact 366-day Gregorian date-label span around a skipped local midnight', async () => {
		const { errors } = await validatePayload({
			startDate: '2018-08-13',
			endDate: '2019-08-14',
			timeZone: 'America/Santiago'
		});

		expect(errors).toHaveLength(0);
	});

	it('rejects a 367-day Gregorian date-label span when the zone skips local midnight', async () => {
		const { errors } = await validatePayload({
			startDate: '2018-08-12',
			endDate: '2019-08-14',
			timeZone: 'America/Santiago'
		});

		expect(hasError(errors, 'endDate')).toBe(true);
	});

	it.each([
		[true, true],
		[false, false],
		['true', true],
		['false', false]
	])('parses includeDaily value %p as %p', async (value, expected) => {
		const { dto, errors } = await validatePayload({ includeDaily: value });

		expect(errors).toHaveLength(0);
		expect(dto.includeDaily).toBe(expected);
	});

	it.each(['TRUE', 'False', '1', 1, 0, null])('rejects non-contract includeDaily value %p', async (value) => {
		const { errors } = await validatePayload({ includeDaily: value });

		expect(hasError(errors, 'includeDaily')).toBe(true);
	});

	it('does not accept tenantId as part of the request contract', async () => {
		const { errors } = await validatePayload(
			{ tenantId: '00000000-0000-4000-8000-000000000004' },
			{ whitelist: true, forbidNonWhitelisted: true }
		);

		expect(hasError(errors, 'tenantId')).toBe(true);
	});
});
