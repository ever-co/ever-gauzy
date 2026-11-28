/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { InviteActionEnum, InviteStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { InviteAcceptCommand } from './commands';
import { InviteService } from './invite.service';
import { UNCONFIRMED_ADDRESS_MESSAGE, UnconfirmedAddressException } from './unconfirmed-address';

/**
 * `GET /invite/me` and `PUT /invite/:id/:action` find invitations by the caller's CURRENT address, and a user can type
 * any address into their own profile, where it is stored unconfirmed. With an unconfirmed address the caller could
 * list other workspaces' invitations to it and answer any of them: join the invited organization and its teams, add
 * another workspace's existing account to a team, create an account in another workspace, or reject the invitation.
 */
const OWN_TENANT = 'tenant-own';
const OTHER_TENANT = 'tenant-other';
const ADDRESS = 'nadia.rahman@example.com';

type Caller = { id: string; email: string; tenantId?: string; emailVerifiedAt?: Date | null };

const caller = (overrides: Partial<Caller> = {}): Caller => ({
	id: 'caller-1',
	email: ADDRESS,
	tenantId: OWN_TENANT,
	emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
	...overrides
});

function build(user: Caller, invitation: { tenantId: string }, invitedTenantUser: unknown = null) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(user.tenantId ?? null);

	const row = {
		id: 'invite-1',
		email: ADDRESS,
		token: 'token-1',
		code: '482913',
		fullName: 'Nadia Ross',
		organizationId: 'org-1',
		invitedByUserId: 'inviter-1',
		tenantId: invitation.tenantId,
		tenant: { id: invitation.tenantId },
		role: { id: 'role-1', name: 'EMPLOYEE' },
		teams: [{ id: 'team-1', name: 'Finance' }]
	};
	const qb = {
		setFindOptions: jest.fn(),
		andWhere: jest.fn(),
		where: jest.fn((fn: (qb: unknown) => void) => fn(qb)),
		getOne: jest.fn(async () => row)
	};
	const typeOrmRepository = {
		metadata: { tableName: 'invite' },
		createQueryBuilder: jest.fn(() => qb),
		findOne: jest.fn(async () => ({ id: 'invite-1', status: InviteStatusEnum.ACCEPTED }))
	};
	const deps = {
		typeOrmRepository,
		typeOrmInviteRepository: { findAndCount: jest.fn(async () => [[], 0]) },
		typeOrmUserRepository: { findOne: jest.fn(async () => invitedTenantUser) },
		typeOrmEmployeeRepository: { findOneOrFail: jest.fn(async () => ({ id: 'employee-other' })) },
		typeOrmOrganizationTeamEmployeeRepository: { save: jest.fn(async (value: unknown) => value) },
		commandBus: { execute: jest.fn(async () => ({})) },
		claimInvite: jest.fn(async () => true),
		releaseInvite: jest.fn(async () => undefined),
		updateInviteStatus: jest.fn(async () => undefined),
		createUser: jest.fn(async () => ({ id: 'user-new' }))
	};
	const service: InviteService = Object.create(InviteService.prototype);
	Object.assign(service, deps);
	return { service, ...deps };
}

const answer = (service: InviteService, action: InviteActionEnum) =>
	service.handleInvitationResponse('invite-1', action, 'https://app.gauzy.co', 'en' as never);

describe('InviteService - answering an invitation needs a confirmed address', () => {
	afterEach(() => jest.restoreAllMocks());

	const unconfirmed = caller({ emailVerifiedAt: null });

	it.each([
		['of their own workspace', OWN_TENANT, null],
		["of another workspace, for that workspace's existing account", OTHER_TENANT, { id: 'user-other', roleId: 'r' }],
		['of another workspace with no account yet', OTHER_TENANT, null]
	])('refuses an unconfirmed address accepting an invitation %s, and writes nothing', async (_label, tenantId, other) => {
		const deps = build(unconfirmed, { tenantId }, other);

		const refusal = answer(deps.service, InviteActionEnum.ACCEPTED);

		await expect(refusal).rejects.toBeInstanceOf(UnconfirmedAddressException);
		await expect(refusal).rejects.toMatchObject({ status: 403, message: UNCONFIRMED_ADDRESS_MESSAGE });
		expect(deps.typeOrmRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(deps.claimInvite).not.toHaveBeenCalled();
		expect(deps.commandBus.execute).not.toHaveBeenCalled();
		expect(deps.typeOrmOrganizationTeamEmployeeRepository.save).not.toHaveBeenCalled();
		expect(deps.createUser).not.toHaveBeenCalled();
		expect(deps.updateInviteStatus).not.toHaveBeenCalled();
	});

	it('refuses an unconfirmed address rejecting an invitation, and leaves it open', async () => {
		const deps = build(unconfirmed, { tenantId: OTHER_TENANT });

		await expect(answer(deps.service, InviteActionEnum.REJECTED)).rejects.toMatchObject({ status: 403 });
		expect(deps.updateInviteStatus).not.toHaveBeenCalled();
	});

	it("still accepts for a confirmed address, in the caller's own workspace", async () => {
		const deps = build(caller(), { tenantId: OWN_TENANT });

		await answer(deps.service, InviteActionEnum.ACCEPTED);

		expect(deps.commandBus.execute).toHaveBeenCalledTimes(1);
		const [command] = deps.commandBus.execute.mock.calls[0] as unknown as [InviteAcceptCommand];
		expect(command).toBeInstanceOf(InviteAcceptCommand);
		expect(command.input).toMatchObject({ email: ADDRESS, token: 'token-1', code: '482913' });
	});

	it("still adds another workspace's existing account to the team, for a confirmed address", async () => {
		const deps = build(caller(), { tenantId: OTHER_TENANT }, { id: 'user-other', roleId: 'role-other' });

		await answer(deps.service, InviteActionEnum.ACCEPTED);

		expect(deps.claimInvite).toHaveBeenCalledWith('invite-1');
		expect(deps.typeOrmOrganizationTeamEmployeeRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({ employeeId: 'employee-other', organizationTeamId: 'team-1', tenantId: OTHER_TENANT })
		);
		expect(deps.updateInviteStatus).toHaveBeenCalledWith('invite-1', InviteStatusEnum.ACCEPTED, 'user-other');
	});

	it('still creates the account in another workspace, for a confirmed address with none there', async () => {
		const deps = build(caller(), { tenantId: OTHER_TENANT });

		await answer(deps.service, InviteActionEnum.ACCEPTED);

		expect(deps.createUser).toHaveBeenCalledTimes(1);
		expect(deps.updateInviteStatus).toHaveBeenCalledWith('invite-1', InviteStatusEnum.ACCEPTED, 'user-new');
	});

	it('still rejects for a confirmed address', async () => {
		const deps = build(caller(), { tenantId: OTHER_TENANT });

		await answer(deps.service, InviteActionEnum.REJECTED);

		expect(deps.updateInviteStatus).toHaveBeenCalledWith('invite-1', InviteStatusEnum.REJECTED);
	});
});

describe("InviteService - listing the caller's invitations", () => {
	afterEach(() => jest.restoreAllMocks());

	const whereOf = (deps: ReturnType<typeof build>) =>
		(deps.typeOrmInviteRepository.findAndCount.mock.calls[0] as unknown as [{ where: object[] }])[0].where;

	it('lists only their own workspace to an unconfirmed address', async () => {
		const deps = build(caller({ emailVerifiedAt: null }), { tenantId: OWN_TENANT });

		await deps.service.getCurrentUserInvites();

		const where = whereOf(deps);
		expect(where).toHaveLength(2);
		for (const branch of where) {
			expect(branch).toMatchObject({ email: ADDRESS, tenantId: OWN_TENANT });
		}
	});

	it('lists every workspace to a confirmed address, as before', async () => {
		const deps = build(caller(), { tenantId: OWN_TENANT });

		await deps.service.getCurrentUserInvites();

		for (const branch of whereOf(deps)) {
			expect(branch).toMatchObject({ email: ADDRESS });
			expect(branch).not.toHaveProperty('tenantId');
		}
	});

	it('lists nothing to an unconfirmed address with no workspace, without querying', async () => {
		const deps = build(caller({ emailVerifiedAt: null, tenantId: undefined }), { tenantId: OWN_TENANT });

		await expect(deps.service.getCurrentUserInvites()).resolves.toEqual({ items: [], total: 0 });
		expect(deps.typeOrmInviteRepository.findAndCount).not.toHaveBeenCalled();
	});
});
