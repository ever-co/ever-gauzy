import '../core/entities/internal';

import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { repriceMemberProjectTime, repriceProjectTime } from '../time-tracking/time-log/time-log-repricing';
import { OrganizationProjectRateService } from './organization-project-rate.service';

jest.mock('../user-organization/assert-organization-membership', () => ({
	assertCurrentUserBelongsToOrganization: jest.fn(async () => undefined)
}));
jest.mock('../time-tracking/time-log/time-log-repricing', () => ({
	repriceProjectTime: jest.fn(async () => 4),
	repriceMemberProjectTime: jest.fn(async () => 2)
}));

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const PROJECT = 'project-1';
const FROM = '2026-10-01T00:00:00.000Z';

/**
 * A client rate change says whether time already tracked takes it: with a day (`applyFrom`), the project's time logs
 * from that day do, and the answer says how many; without one, only time recorded from then on does.
 */
describe('OrganizationProjectRateService: a client rate applied from a day', () => {
	let service: OrganizationProjectRateService;

	beforeEach(() => {
		(repriceProjectTime as jest.Mock).mockClear();
		(repriceMemberProjectTime as jest.Mock).mockClear();
		const manager = { findOne: jest.fn(async () => ({ id: ORGANIZATION, currency: 'EUR' })) };
		const projectRepository = {
			findOne: jest.fn(async () => ({ id: PROJECT, billRateValue: 90, currency: null })),
			update: jest.fn(async () => ({ affected: 1 })),
			manager
		};
		const membershipRepository = {
			findOne: jest.fn(async () => ({ id: 'membership-1' })),
			update: jest.fn(async () => ({ affected: 1 }))
		};
		service = new OrganizationProjectRateService(projectRepository as never, membershipRepository as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.ORG_EMPLOYEES_EDIT
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it("gives the project's time from the day the new rate, in the project's own currency, and says how much", async () => {
		const answer = await service.updateProjectRate(PROJECT, {
			organizationId: ORGANIZATION,
			billRateValue: 120,
			applyFrom: FROM
		});

		expect(repriceProjectTime).toHaveBeenCalledWith(
			expect.anything(),
			{ tenantId: TENANT, organizationId: ORGANIZATION, from: new Date(FROM) },
			PROJECT,
			{ billRateValue: 120, currency: 'EUR' }
		);
		expect(answer).toEqual({ id: PROJECT, billRateValue: 120, currency: 'EUR', repricedTimeLogs: 4 });
	});

	it("gives a member's time on the project from the day their new client rate", async () => {
		const answer = await service.updateMemberRate(PROJECT, 'employee-2', {
			organizationId: ORGANIZATION,
			billRateValue: 95,
			applyFrom: FROM
		});

		expect(repriceMemberProjectTime).toHaveBeenCalledWith(
			expect.anything(),
			{ tenantId: TENANT, organizationId: ORGANIZATION, from: new Date(FROM) },
			PROJECT,
			'employee-2',
			{ billRateValue: 95, currency: 'EUR' }
		);
		expect(answer).toMatchObject({ billRateValue: 95, repricedTimeLogs: 2 });
	});

	it('re-prices nothing without a day: past time keeps its price', async () => {
		const answer = await service.updateProjectRate(PROJECT, { organizationId: ORGANIZATION, billRateValue: 120 });

		expect(repriceProjectTime).not.toHaveBeenCalled();
		expect(answer).not.toHaveProperty('repricedTimeLogs');
	});
});
