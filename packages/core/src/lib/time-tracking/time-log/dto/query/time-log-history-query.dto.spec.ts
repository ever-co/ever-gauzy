// Must stay first: see time-log.service.spec.ts.
import '../../../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrganizationBelongsToUserConstraint } from '../../../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { TimeLogHistoryQueryDTO } from './time-log-history-query.dto';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const PERIOD = { startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T23:59:59.999Z' };

/**
 * A history read binds the organization id it is given, so the id is required, and checked against the caller's
 * organizations, whatever else the query names (ever-co/ever-gauzy#11922).
 */
describe('TimeLogHistoryQueryDTO', () => {
	/** The errors of the query as the route's pipe validates it: transformed, then stripped of what is not declared. */
	const errorsOf = async (query: Record<string, unknown>) => {
		const dto = plainToInstance(TimeLogHistoryQueryDTO, query);
		const errors = await validate(dto, { whitelist: true });
		return errors.map((error) => error.property);
	};

	beforeEach(() => {
		jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockResolvedValue(true);
	});
	afterEach(() => jest.restoreAllMocks());

	it('accepts a period of one of the caller organizations', async () => {
		expect(await errorsOf({ ...PERIOD, organizationId: ORGANIZATION })).toEqual([]);
	});

	it('refuses a period read that names its organization by an object only', async () => {
		expect(await errorsOf({ ...PERIOD, organization: { id: ORGANIZATION } })).toContain('organizationId');
	});

	it('refuses a period read that names no organization', async () => {
		expect(await errorsOf(PERIOD)).toContain('organizationId');
	});
});
