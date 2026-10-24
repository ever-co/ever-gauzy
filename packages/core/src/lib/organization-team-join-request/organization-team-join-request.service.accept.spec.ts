import '../core/entities/internal';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { LanguagesEnum, OrganizationTeamJoinRequestStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

/**
 * #10708 — accepting a join request from someone who is already an employee of the tenant answered 404.
 *
 * The "is the employee already on the team?" read raises a 404 on a miss, and nothing caught it, so the
 * employee was never added and the request stayed PENDING. A miss now means "not on the team yet"; any
 * other failure of that read is raised, never read as a miss that would add the employee a second time.
 */
describe('OrganizationTeamJoinRequestService.acceptRequestToJoin for an existing employee', () => {
	const TENANT = 'tenant-1';
	const REQUEST = {
		id: 'request-1',
		email: 'member@ever.co',
		organizationId: 'organization-1',
		organizationTeamId: 'team-1',
		tenantId: TENANT,
		// Confirmed by the requester through the mailed code, so it waits for a manager's decision.
		status: OrganizationTeamJoinRequestStatusEnum.REQUESTED
	};

	let teams: { findOneByWhereOptions: jest.Mock; findOneOrFailByWhereOptions: jest.Mock };
	let memberships: { save: jest.Mock };
	let update: jest.SpyInstance;
	let service: OrganizationTeamJoinRequestService;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('admin-user');
		update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as never);

		teams = {
			findOneByWhereOptions: jest.fn(),
			// As `CrudService` answers it: every failure of the read, not only a miss, comes back as `success: false`.
			findOneOrFailByWhereOptions: jest.fn(async (where) => {
				try {
					return { success: true, record: await teams.findOneByWhereOptions(where) };
				} catch (error) {
					return { success: false, error };
				}
			})
		};
		memberships = { save: jest.fn(async (row) => row) };

		service = Object.create(OrganizationTeamJoinRequestService.prototype);
		Object.assign(service, {
			findOneByWhereOptions: jest.fn(async () => REQUEST),
			typeOrmUserRepository: { findOne: jest.fn(async () => ({ id: 'member-user', tenantId: TENANT })) },
			typeOrmOrganizationTeamEmployeeRepository: memberships,
			_employeeService: { findOneByOptions: jest.fn(async () => ({ id: 'member-employee' })) },
			_organizationTeamService: teams
		});
	});

	afterEach(() => jest.restoreAllMocks());

	const accept = () =>
		service.acceptRequestToJoin(REQUEST.id, OrganizationTeamJoinRequestStatusEnum.ACCEPTED, LanguagesEnum.ENGLISH);

	it('adds an employee who is not on the team yet, and marks the request accepted', async () => {
		teams.findOneByWhereOptions.mockRejectedValue(new NotFoundException('The requested record was not found'));

		await expect(accept()).resolves.toBeUndefined();

		expect(memberships.save).toHaveBeenCalledWith({
			employeeId: 'member-employee',
			organizationTeamId: REQUEST.organizationTeamId,
			tenantId: TENANT,
			organizationId: REQUEST.organizationId
		});
		expect(update).toHaveBeenCalledWith(REQUEST.id, {
			status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
			userId: 'member-user'
		});
	});

	it('marks the request accepted for an employee already on the team, without adding them again', async () => {
		teams.findOneByWhereOptions.mockResolvedValue({ id: REQUEST.organizationTeamId });

		await expect(accept()).resolves.toBeUndefined();

		expect(memberships.save).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledWith(REQUEST.id, {
			status: OrganizationTeamJoinRequestStatusEnum.ACCEPTED,
			userId: 'member-user'
		});
	});

	it('raises a failed membership read instead of reading it as a miss and adding the employee', async () => {
		const failure = new Error('connection terminated unexpectedly');
		teams.findOneByWhereOptions.mockRejectedValue(failure);

		await expect(accept()).rejects.toBe(failure);

		expect(memberships.save).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});
});

/**
 * Privilege-escalation audit 2026-10-24, F10: `acceptRequestToJoin` never read the request's status. A request is
 * stored with `status: null` by the public create and only becomes `REQUESTED` once the requester presents the
 * mailed code. So a manager could accept an address nobody had confirmed: that added the employee behind it to the
 * team without their consent, or provisioned a passwordless EMPLOYEE account for it. Only `REQUESTED` is accepted.
 */
describe('OrganizationTeamJoinRequestService.acceptRequestToJoin accepts only a confirmed request', () => {
	const TENANT = 'tenant-1';
	const { ACCEPTED, REJECTED, REQUESTED } = OrganizationTeamJoinRequestStatusEnum;
	const base = {
		id: 'request-1',
		email: 'someone@example.com',
		fullName: 'Some One',
		organizationId: 'organization-1',
		organizationTeamId: 'team-1',
		tenantId: TENANT
	};

	let update: jest.SpyInstance;
	let findUser: jest.Mock;
	let createUser: jest.Mock;
	let saveMembership: jest.Mock;

	const serviceFor = (request: Record<string, unknown>) => {
		const service = Object.create(OrganizationTeamJoinRequestService.prototype);
		Object.assign(service, {
			findOneByWhereOptions: jest.fn(async () => request),
			typeOrmUserRepository: { findOne: findUser },
			typeOrmOrganizationTeamEmployeeRepository: { save: saveMembership },
			_employeeService: { findOneByOptions: jest.fn(async () => ({ id: 'employee-1' })) },
			_organizationTeamService: {
				findOneByWhereOptions: jest.fn().mockRejectedValue(new NotFoundException('Not on the team yet'))
			},
			_roleService: { findOneByWhereOptions: jest.fn(async () => ({ id: 'role-employee' })) },
			_inviteService: { createUser }
		});
		return service as OrganizationTeamJoinRequestService;
	};

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('manager-user');
		update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as never);
		findUser = jest.fn(async () => null);
		createUser = jest.fn(async () => ({ id: 'new-user' }));
		saveMembership = jest.fn(async (row) => row);
	});

	afterEach(() => jest.restoreAllMocks());

	const act = (request: Record<string, unknown>, action: OrganizationTeamJoinRequestStatusEnum) =>
		serviceFor(request).acceptRequestToJoin(request.id as string, action, LanguagesEnum.ENGLISH);

	it('refuses an unconfirmed request, and neither provisions a user nor adds anyone to the team', async () => {
		await expect(act({ ...base, status: null }, ACCEPTED)).rejects.toBeInstanceOf(ConflictException);

		expect(findUser).not.toHaveBeenCalled();
		expect(createUser).not.toHaveBeenCalled();
		expect(saveMembership).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it.each([ACCEPTED, REJECTED])('refuses to accept a request that was already %s', async (status) => {
		await expect(act({ ...base, status }, ACCEPTED)).rejects.toBeInstanceOf(ConflictException);

		expect(createUser).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('accepts a confirmed request, provisioning the user as before', async () => {
		await expect(act({ ...base, status: REQUESTED }, ACCEPTED)).resolves.toBeUndefined();

		expect(createUser).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith(base.id, { status: ACCEPTED, userId: 'new-user' });
	});

	it('still lets a manager reject an unconfirmed request', async () => {
		await expect(act({ ...base, status: null }, REJECTED)).resolves.toBeUndefined();

		expect(update).toHaveBeenCalledWith(base.id, { status: REJECTED });
	});
});
