import '../core/entities/internal';

// The token is signed with the configured JWT secret, which a unit test does not need.
jest.mock('../auth/purpose-token', () => ({
	...jest.requireActual('../auth/purpose-token'),
	signPurposeToken: jest.fn(() => 'signed-team-join-token')
}));

import { CrudService } from '../core/crud';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

/**
 * #10672: asking to join a public team is a public route, so there is no caller tenant. `save()` stamped that
 * missing tenant over the team's, the request was stored with a NULL `tenantId`, managers never saw it and
 * accepting it answered 404. The request has to keep the tenant of the public team it names.
 */
describe('OrganizationTeamJoinRequestService.create on the public join route (#10672)', () => {
	let save: jest.SpyInstance;
	let findOneByIdString: jest.Mock;
	let sendEmail: jest.Mock;
	let service: OrganizationTeamJoinRequestService;

	beforeEach(() => {
		save = jest
			.spyOn(CrudService.prototype, 'save')
			.mockImplementation(async (entity: any) => ({ id: 'request-1', ...entity }));
		findOneByIdString = jest.fn(async () => ({
			id: 'team-1',
			public: true,
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			organization: { id: 'org-1', tenantId: 'tenant-1' }
		}));
		sendEmail = jest.fn();

		service = Object.create(OrganizationTeamJoinRequestService.prototype);
		Object.assign(service, {
			count: jest.fn(async () => 0),
			typeOrmRepository: {
				create: jest.fn((input: Partial<OrganizationTeamJoinRequest>) =>
					Object.assign(new OrganizationTeamJoinRequest(), input)
				)
			},
			_organizationTeamService: { findOneByIdString },
			_emailService: { organizationTeamJoinRequest: sendEmail }
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('saves the request with the tenant of the public team, not the missing caller tenant', async () => {
		const created = await service.create({ organizationTeamId: 'team-1', email: 'guest@ever.co' } as any);

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0][0]).toEqual(
			expect.objectContaining({
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				organizationTeamId: 'team-1',
				email: 'guest@ever.co',
				status: null
			})
		);
		expect(created.tenantId).toBe('tenant-1');
		// The verification email is sent for the stored request, tenant included.
		expect(sendEmail.mock.calls[0][1]).toEqual(expect.objectContaining({ tenantId: 'tenant-1' }));
	});

	it('takes the tenant from a team found among public teams only', async () => {
		await service.create({ organizationTeamId: 'team-1', email: 'guest@ever.co' } as any);

		expect(findOneByIdString).toHaveBeenCalledWith(
			'team-1',
			expect.objectContaining({ where: expect.objectContaining({ public: true }) })
		);
	});
});
