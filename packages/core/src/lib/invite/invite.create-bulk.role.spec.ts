/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { InviteService } from './invite.service';

/**
 * GHSA-x4mv-fhwj-g3rp sibling — `POST /invite/emails` (ORG_INVITE_EDIT or ORG_TEAM_ADD).
 *
 * The service decided which role an invitation may carry (an EMPLOYEE inviter is limited to the
 * EMPLOYEE role; others to the role they asked for, SUPER_ADMIN only for a super admin) and then
 * persisted the BODY `roleId` regardless. An employee could therefore mint SUPER_ADMIN invitations.
 * The invitation now carries the role that was checked.
 */
describe('InviteService.createBulk role (GHSA-x4mv-fhwj-g3rp)', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'org-1';
	const ROLES: Record<string, { id: string; name: RolesEnum }> = {
		'role-employee': { id: 'role-employee', name: RolesEnum.EMPLOYEE },
		'role-manager': { id: 'role-manager', name: RolesEnum.MANAGER },
		'role-super-admin': { id: 'role-super-admin', name: RolesEnum.SUPER_ADMIN }
	};

	/** Thrown by the stubbed saveMany so the test stops before the e-mail side effects. */
	class Saved extends Error {
		constructor(readonly invites: any[]) {
			super('saved');
		}
	}

	function build(callerRoleId: string) {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('inviter-1');
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(callerRoleId);

		const roleService = {
			// The real call is tenant-scoped; `where: { name }` narrows the caller-role probe to EMPLOYEE.
			findOneByIdString: jest.fn(async (id: string, options?: any) => {
				const role = ROLES[id];
				if (!role || (options?.where?.name && options.where.name !== role.name)) {
					throw new Error('EntityNotFound');
				}
				return role;
			})
		};

		const service: InviteService = Object.create(InviteService.prototype);
		Object.assign(service, {
			configService: { get: () => 'http://localhost:4200' },
			fetchInvitesRelations: jest.fn(async () => ({
				projects: [],
				departments: [],
				organizationContacts: [],
				organizationTeams: []
			})),
			userService: {
				findOneByIdString: jest.fn(async () => ({ id: 'inviter-1', role: ROLES[callerRoleId] }))
			},
			roleService,
			organizationService: { findOneByIdString: jest.fn(async () => ({ id: ORGANIZATION, inviteExpiryPeriod: 7 })) },
			findAll: jest.fn(async () => ({ items: [], total: 0 })),
			typeOrmOrganizationTeamEmployeeRepository: { findBy: jest.fn(async () => []) },
			saveMany: jest.fn(async (invites: any[]) => {
				throw new Saved(invites);
			})
		});
		return { service, roleService };
	}

	async function invitesOf(service: InviteService, body: Record<string, unknown>): Promise<any[]> {
		try {
			await service.createBulk(
				{ emailIds: ['new@example.com'], organizationId: ORGANIZATION, tenantId: TENANT, ...body } as any,
				'en' as any
			);
		} catch (error) {
			if (error instanceof Saved) {
				return error.invites;
			}
			throw error;
		}
		throw new Error('saveMany was not reached');
	}

	afterEach(() => jest.restoreAllMocks());

	it('an EMPLOYEE inviter asking for SUPER_ADMIN issues an EMPLOYEE invitation', async () => {
		const { service } = build('role-employee');

		const [invite] = await invitesOf(service, { roleId: 'role-super-admin' });

		// CONTROL: the body asked for SUPER_ADMIN; pre-fix this is exactly what was persisted.
		expect(invite.roleId).not.toBe('role-super-admin');
		expect(invite.roleId).toBe('role-employee');
	});

	it('a manager still invites with the role it asked for', async () => {
		const { service } = build('role-manager');

		const [invite] = await invitesOf(service, { roleId: 'role-employee' });

		expect(invite.roleId).toBe('role-employee');
	});

	it('still refuses a non-super-admin asking for SUPER_ADMIN, in any form', async () => {
		for (const body of [{ roleId: 'role-super-admin' }, { role: 'role-super-admin' }, { role: { id: 'role-super-admin' } }]) {
			const { service } = build('role-manager');
			await expect(invitesOf(service, body)).rejects.toBeInstanceOf(UnauthorizedException);
			jest.restoreAllMocks();
		}
	});

	it('refuses a body naming two different roles, or none', async () => {
		for (const body of [{ roleId: 'role-employee', role: { id: 'role-super-admin' } }, {}, { role: {} }]) {
			const { service } = build('role-manager');
			await expect(invitesOf(service, body)).rejects.toBeInstanceOf(BadRequestException);
			jest.restoreAllMocks();
		}
	});

	/**
	 * The EMPLOYEE branch is force-assigned the EMPLOYEE role, so a bad payload was never a privilege
	 * escalation here — but it was silently accepted, and the same body answered 400 for every other
	 * inviter. Input validation now runs before the branch, so the answer no longer depends on who asks.
	 */
	it('refuses a malformed or self-contradicting body from an EMPLOYEE inviter too', async () => {
		for (const body of [
			{ roleId: 'role-employee', role: { id: 'role-super-admin' } },
			{ roleId: 'role-manager', role: 'role-super-admin' },
			{ role: {} },
			{ roleId: '' }
		]) {
			const { service } = build('role-employee');
			await expect(invitesOf(service, body)).rejects.toBeInstanceOf(BadRequestException);
			jest.restoreAllMocks();
		}
	});

	it('still lets an EMPLOYEE inviter send a body with no role at all', async () => {
		const { service } = build('role-employee');

		const [invite] = await invitesOf(service, {});

		expect(invite.roleId).toBe('role-employee');
	});
});
