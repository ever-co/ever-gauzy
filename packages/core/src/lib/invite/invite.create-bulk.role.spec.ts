/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or handler — the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { InviteService } from './invite.service';

/**
 * GHSA-x4mv-fhwj-g3rp sibling — `POST /invite/emails` (ORG_INVITE_EDIT or ORG_TEAM_ADD).
 *
 * The service decided which role an invitation may carry and then persisted the BODY `roleId`
 * regardless. An employee could therefore mint SUPER_ADMIN invitations. The invitation now carries
 * the role that was checked.
 *
 * Role ceiling (owner decision, 2026-10-22): an inviter grants only their own level or lower —
 * SUPER_ADMIN > ADMIN > MANAGER > DATA_ENTRY / EMPLOYEE > VIEWER / CANDIDATE / INTERVIEWER. Before it,
 * any inviter but an employee could grant any role except SUPER_ADMIN, so a manager invited admins.
 */
describe('InviteService.createBulk role (GHSA-x4mv-fhwj-g3rp)', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'org-1';
	const ROLES: Record<string, { id: string; name: string }> = {
		'role-super-admin': { id: 'role-super-admin', name: RolesEnum.SUPER_ADMIN },
		'role-admin': { id: 'role-admin', name: RolesEnum.ADMIN },
		'role-manager': { id: 'role-manager', name: RolesEnum.MANAGER },
		'role-data-entry': { id: 'role-data-entry', name: RolesEnum.DATA_ENTRY },
		'role-employee': { id: 'role-employee', name: RolesEnum.EMPLOYEE },
		'role-viewer': { id: 'role-viewer', name: RolesEnum.VIEWER },
		'role-candidate': { id: 'role-candidate', name: RolesEnum.CANDIDATE },
		'role-interviewer': { id: 'role-interviewer', name: RolesEnum.INTERVIEWER },
		// A role the tenant created itself.
		'role-custom': { id: 'role-custom', name: 'RECRUITER' }
	};

	/** The owner's order, highest first; roles on one line share a level. */
	const LEVELS: string[][] = [
		['role-super-admin'],
		['role-admin'],
		['role-manager'],
		['role-data-entry', 'role-employee'],
		['role-viewer', 'role-candidate', 'role-interviewer']
	];
	const levelOf = (roleId: string) => LEVELS.length - LEVELS.findIndex((level) => level.includes(roleId));

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
			// The real call is tenant-scoped; `where: { name }` narrowed the caller-role probe to EMPLOYEE.
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

	it('an EMPLOYEE inviter asking for SUPER_ADMIN is refused, and no invitation is written', async () => {
		const { service } = build('role-employee');

		// CONTROL: before GHSA-x4mv-fhwj-g3rp the body role was persisted; before the ceiling it was
		// swapped for EMPLOYEE without a word. Now the request is refused.
		await expect(invitesOf(service, { roleId: 'role-super-admin' })).rejects.toBeInstanceOf(ForbiddenException);
		expect(service.saveMany).not.toHaveBeenCalled();
	});

	it('a manager still invites an employee with the role it asked for', async () => {
		const { service } = build('role-manager');

		const [invite] = await invitesOf(service, { roleId: 'role-employee' });

		expect(invite.roleId).toBe('role-employee');
	});

	it('a manager cannot invite an ADMIN, in any form', async () => {
		for (const body of [{ roleId: 'role-admin' }, { role: 'role-admin' }, { role: { id: 'role-admin' } }]) {
			const { service } = build('role-manager');
			await expect(invitesOf(service, body)).rejects.toBeInstanceOf(ForbiddenException);
			expect(service.saveMany).not.toHaveBeenCalled();
			jest.restoreAllMocks();
		}
	});

	it('still refuses a non-super-admin asking for SUPER_ADMIN, in any form', async () => {
		for (const caller of ['role-admin', 'role-manager']) {
			for (const body of [
				{ roleId: 'role-super-admin' },
				{ role: 'role-super-admin' },
				{ role: { id: 'role-super-admin' } }
			]) {
				const { service } = build(caller);
				await expect(invitesOf(service, body)).rejects.toBeInstanceOf(ForbiddenException);
				jest.restoreAllMocks();
			}
		}
	});

	it('every built-in inviter grants exactly its own level and the levels below it', async () => {
		const ids = LEVELS.flat();
		for (const caller of ids) {
			for (const requested of ids) {
				const { service } = build(caller);
				const outcome = await invitesOf(service, { roleId: requested }).then(
					([invite]) => invite.roleId,
					(error) => (error instanceof ForbiddenException ? 'refused' : error)
				);
				const expected = levelOf(requested) <= levelOf(caller) ? requested : 'refused';
				expect({ caller, requested, outcome }).toEqual({ caller, requested, outcome: expected });
				jest.restoreAllMocks();
			}
		}
	});

	it('only a tenant admin grants a role the tenant created, and an inviter holding one ranks lowest', async () => {
		for (const caller of ['role-super-admin', 'role-admin']) {
			const { service } = build(caller);
			const [invite] = await invitesOf(service, { roleId: 'role-custom' });
			expect(invite.roleId).toBe('role-custom');
			jest.restoreAllMocks();
		}
		for (const caller of ['role-manager', 'role-employee', 'role-viewer', 'role-custom']) {
			const { service } = build(caller);
			await expect(invitesOf(service, { roleId: 'role-custom' })).rejects.toBeInstanceOf(ForbiddenException);
			jest.restoreAllMocks();
		}

		const { service } = build('role-custom');
		const [invite] = await invitesOf(service, { roleId: 'role-viewer' });
		expect(invite.roleId).toBe('role-viewer');
		jest.restoreAllMocks();

		const { service: custom } = build('role-custom');
		await expect(invitesOf(custom, { roleId: 'role-employee' })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses an inviter with no role', async () => {
		const { service } = build('role-gone');

		await expect(invitesOf(service, { roleId: 'role-viewer' })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses a body naming two different roles, or none', async () => {
		for (const body of [{ roleId: 'role-employee', role: { id: 'role-super-admin' } }, {}, { role: {} }]) {
			const { service } = build('role-manager');
			await expect(invitesOf(service, body)).rejects.toBeInstanceOf(BadRequestException);
			jest.restoreAllMocks();
		}
	});

	/**
	 * An EMPLOYEE inviter's malformed payload was once silently accepted, while the same body answered
	 * 400 for every other inviter. Input validation runs first, so the answer does not depend on who asks.
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
