/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { InvitationTypeEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { InviteService } from './invite.service';

/**
 * Listing (`GET /invite`) and resending (`POST /invite/resend`) an invitation hand out its accept-invite token, so both
 * apply the role ceiling `createBulk` applies when it mints one (ever-co/ever-gauzy#11318), and both rank the caller by
 * the same role: the one stored for them, not the request context's (`RequestContext.currentRoleName()`), which with
 * `JWT_AUTHENTICATED_USER_TTL_MS` set may come from a reused authenticated-user context, from before a role change.
 */
describe('InviteService - invitation tokens follow the role ceiling, by the stored role', () => {
	const ROLES = {
		admin: { id: 'role-admin', name: RolesEnum.ADMIN },
		manager: { id: 'role-manager', name: RolesEnum.MANAGER },
		employee: { id: 'role-employee', name: RolesEnum.EMPLOYEE },
		viewer: { id: 'role-viewer', name: RolesEnum.VIEWER }
	};

	let emailService: { inviteTeamMember: jest.Mock; inviteUser: jest.Mock; inviteEmployee: jest.Mock };

	beforeEach(() => {
		emailService = { inviteTeamMember: jest.fn(), inviteUser: jest.fn(), inviteEmployee: jest.fn() };
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('caller-1');
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * @param storedRole The role stored for the caller.
	 * @param sessionRole The role in the request context.
	 * @param inviteRole The role of the invitation resent.
	 */
	function build(storedRole: { name: string } | null, sessionRole: RolesEnum, inviteRole = ROLES.admin) {
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(sessionRole);
		const userService = {
			findOneByIdString: jest.fn(async () => ({ id: 'caller-1', role: storedRole }))
		};
		const service: InviteService = Object.create(InviteService.prototype);
		Object.assign(service, {
			logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
			configService: { get: () => 'https://app.gauzy.co' },
			emailService,
			userService,
			roleService: { find: jest.fn(async () => Object.values(ROLES)) },
			findOneByIdString: jest.fn(async () => ({
				id: 'invite-1',
				email: 'new@ever.co',
				organization: { id: 'org-1', tenantId: 'tenant-1' },
				role: inviteRole,
				teams: []
			}))
		});
		return { service, userService };
	}

	describe('resendEmail', () => {
		const resend = (service: InviteService) =>
			service.resendEmail({ inviteId: 'invite-1', inviteType: InvitationTypeEnum.USER } as any, 'en' as any);

		beforeEach(() => {
			// `super.update` at the end of resendEmail.
			jest.spyOn(TenantAwareCrudService.prototype as any, 'update').mockResolvedValue({} as never);
		});

		it('refuses a manager resending an admin invitation, even with ADMIN still in the request context', async () => {
			const { service, userService } = build(ROLES.manager, RolesEnum.ADMIN);

			await expect(resend(service)).rejects.toBeInstanceOf(ForbiddenException);

			expect(userService.findOneByIdString).toHaveBeenCalledWith('caller-1', { relations: { role: true } });
			expect(emailService.inviteUser).not.toHaveBeenCalled();
		});

		it('lets an admin resend an admin invitation, even with a lower role in the request context', async () => {
			const { service } = build(ROLES.admin, RolesEnum.MANAGER);

			await resend(service);

			expect(emailService.inviteUser).toHaveBeenCalledTimes(1);
		});

		it('lets a manager resend an employee invitation, as createBulk lets it issue one', async () => {
			const { service } = build(ROLES.manager, RolesEnum.MANAGER, ROLES.employee);

			await resend(service);

			expect(emailService.inviteUser).toHaveBeenCalledTimes(1);
		});

		it('refuses a caller with no stored role', async () => {
			const { service } = build(null, RolesEnum.SUPER_ADMIN, ROLES.viewer);

			await expect(resend(service)).rejects.toBeInstanceOf(ForbiddenException);
			expect(emailService.inviteUser).not.toHaveBeenCalled();
		});
	});

	describe('findAllInvites', () => {
		const register = () =>
			[ROLES.admin, ROLES.manager, ROLES.employee, ROLES.viewer].map((role) => ({
				id: `invite-${role.name}`,
				token: `token-of-${role.name}`,
				roleId: role.id,
				role
			}));

		function list(storedRole: { name: string } | null, sessionRole: RolesEnum, mayIssueInvites = true) {
			const items = register();
			jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items, total: items.length });
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission === PermissionsEnum.ORG_INVITE_EDIT && mayIssueInvites
			);
			const { service, userService } = build(storedRole, sessionRole);
			return { service, userService, items };
		}
		const tokens = (items: { token?: string }[]) => items.map((invite) => invite.token);

		it('ranks the caller by the stored role: a manager with ADMIN in the context keeps no admin token', async () => {
			const { service, items } = list(ROLES.manager, RolesEnum.ADMIN);

			await service.findAllInvites({} as any);

			expect(tokens(items)).toEqual([undefined, 'token-of-MANAGER', 'token-of-EMPLOYEE', 'token-of-VIEWER']);
		});

		it('an employee keeps the employee and contact (viewer) tokens only', async () => {
			const { service, items } = list(ROLES.employee, RolesEnum.EMPLOYEE);

			await service.findAllInvites({} as any);

			expect(tokens(items)).toEqual([undefined, undefined, 'token-of-EMPLOYEE', 'token-of-VIEWER']);
		});

		it('an admin keeps every token listed', async () => {
			const { service, items } = list(ROLES.admin, RolesEnum.MANAGER);

			await service.findAllInvites({} as any);

			expect(tokens(items)).toEqual([
				'token-of-ADMIN',
				'token-of-MANAGER',
				'token-of-EMPLOYEE',
				'token-of-VIEWER'
			]);
		});

		it('does not read the stored role for a caller who may not issue invitations', async () => {
			const { service, userService, items } = list(ROLES.admin, RolesEnum.ADMIN, false);

			await service.findAllInvites({} as any);

			expect(tokens(items)).toEqual([undefined, undefined, undefined, undefined]);
			expect(userService.findOneByIdString).not.toHaveBeenCalled();
		});
	});
});
