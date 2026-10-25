/**
 * This import must stay FIRST, before any import that pulls a core service or handler: the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema as TypeOrmEntitySchema, FindOperator, In } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { InvitationTypeEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { BaseEntity } from '../core/entities/base.entity';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { InviteService } from './invite.service';

/** A team, as far as the invitation flows read it. */
interface ISpecTeam {
	id: string;
	name: string;
	createdByUserId?: string;
	deletedAt?: Date;
	members?: ISpecMember[];
}

/** A membership of a team, with the team role it holds. */
interface ISpecMember {
	id: string;
	organizationTeamId: string;
	employeeId: string;
	isManager?: boolean;
	roleId?: string;
	organizationTeam?: ISpecTeam;
	role?: { id: string; name: string };
}

/** An invitation, as far as the register reads it. */
interface ISpecInvite {
	id: string;
	email: string;
	tenantId: string;
	teams?: ISpecTeam[];
}

/** A store of invitations or teams, read through the CRUD base as `InviteService` and its team service read them. */
class SpecStore extends CrudService<BaseEntity> {}

/** The team table; soft-deletable, as `organization_team` is, so TypeORM joins only the teams not deleted. */
const TYPEORM_TEAM = new TypeOrmEntitySchema<ISpecTeam>({
	name: 'InviteRegisterTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		createdByUserId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		members: { type: 'one-to-many', target: 'InviteRegisterMember', inverseSide: 'organizationTeam' }
	}
});

/** The memberships of the teams, as `organization_team_employee` maps them, with their team role. */
const TYPEORM_MEMBER = new TypeOrmEntitySchema<ISpecMember>({
	name: 'InviteRegisterMember',
	tableName: 'organization_team_employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		organizationTeamId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		isManager: { type: 'boolean', nullable: true },
		roleId: { type: 'varchar', nullable: true }
	},
	relations: {
		organizationTeam: {
			type: 'many-to-one',
			target: 'InviteRegisterTeam',
			joinColumn: { name: 'organizationTeamId' }
		},
		role: { type: 'many-to-one', target: 'InviteRegisterRole', joinColumn: { name: 'roleId' } }
	}
});

const TYPEORM_ROLE = new TypeOrmEntitySchema<{ id: string; name: string }>({
	name: 'InviteRegisterRole',
	tableName: 'role',
	columns: { id: { primary: true, type: 'varchar' }, name: { type: 'varchar' } }
});

/** The invitation table and its teams, mapped as `Invite.teams` maps them. */
const TYPEORM_INVITE = new TypeOrmEntitySchema<ISpecInvite>({
	name: 'InviteRegisterInvite',
	tableName: 'invite',
	columns: {
		id: { primary: true, type: 'varchar' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar' }
	},
	relations: {
		teams: {
			type: 'many-to-many',
			target: 'InviteRegisterTeam',
			joinTable: {
				name: 'invite_organization_team',
				joinColumn: { name: 'inviteId', referencedColumnName: 'id' },
				inverseJoinColumn: { name: 'organizationTeamId', referencedColumnName: 'id' }
			}
		}
	}
});

class MikroOrmInviteTeam {
	id!: string;
	name!: string;
	createdByUserId?: string;
	deletedAt?: Date;
	members?: unknown;
}

class MikroOrmTeamMember {
	id!: string;
	employeeId!: string;
	isManager?: boolean;
	organizationTeam?: unknown;
	role?: unknown;
}

class MikroOrmTeamRole {
	id!: string;
	name!: string;
}

class MikroOrmInvite {
	id!: string;
	email!: string;
	tenantId!: string;
	teams?: unknown;
}

/** The team table, with the filter `@SoftDeletable` puts on the platform's entities, so a deleted team is read out. */
const MIKRO_ORM_TEAM = new MikroOrmEntitySchema<MikroOrmInviteTeam>({
	class: MikroOrmInviteTeam,
	tableName: 'organization_team',
	filters: { [SOFT_DELETABLE_FILTER]: { name: SOFT_DELETABLE_FILTER, cond: { deletedAt: null }, default: true } },
	properties: {
		id: { type: 'string', primary: true },
		name: { type: 'string' },
		createdByUserId: { type: 'string', nullable: true },
		deletedAt: { type: 'Date', nullable: true },
		members: { kind: '1:m', entity: () => MikroOrmTeamMember, mappedBy: 'organizationTeam' } as never
	}
});

const MIKRO_ORM_MEMBER = new MikroOrmEntitySchema<MikroOrmTeamMember>({
	class: MikroOrmTeamMember,
	tableName: 'organization_team_employee',
	properties: {
		id: { type: 'string', primary: true },
		employeeId: { type: 'string' },
		isManager: { type: 'boolean', nullable: true },
		organizationTeam: { kind: 'm:1', entity: () => MikroOrmInviteTeam, fieldName: 'organizationTeamId' } as never,
		role: { kind: 'm:1', entity: () => MikroOrmTeamRole, fieldName: 'roleId', nullable: true } as never
	}
});

const MIKRO_ORM_ROLE = new MikroOrmEntitySchema<MikroOrmTeamRole>({
	class: MikroOrmTeamRole,
	tableName: 'role',
	properties: { id: { type: 'string', primary: true }, name: { type: 'string' } }
});

const MIKRO_ORM_INVITE = new MikroOrmEntitySchema<MikroOrmInvite>({
	class: MikroOrmInvite,
	tableName: 'invite',
	properties: {
		id: { type: 'string', primary: true },
		email: { type: 'string' },
		tenantId: { type: 'string' },
		teams: {
			kind: 'm:n',
			entity: () => MikroOrmInviteTeam,
			owner: true,
			pivotTable: 'invite_organization_team',
			joinColumn: 'inviteId',
			inverseJoinColumn: 'organizationTeamId'
		} as never
	}
});

/**
 * The invitation routes need only ORG_INVITE_VIEW or ORG_INVITE_EDIT, which every employee holds and which also serve
 * their own invitations (`GET /invite/me`, accepting one). So any employee listed, resent and deleted the invitations
 * of every team of their organization, and invited people into any of its teams, over REST and GraphQL alike.
 *
 * Owner decision, 2026-10-25: without ALL_ORG_VIEW, ALL_ORG_EDIT or CHANGE_SELECTED_EMPLOYEE, a caller handles the
 * invitations of the teams they manage, as only a team's managers decide on its join requests: a member flagged
 * `isManager` or holding a MANAGER, ADMIN or SUPER_ADMIN team role, or the team's creator. Invitations of no team stay
 * as they were, and so does a call without a request user. The register lists an invitation to a manager of any of
 * its teams; sending, resending and deleting one, which act for all its teams, take a manager of every one of them.
 */
describe('InviteService - the invitations of a team are handled by its managers', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'organization-1';
	const CALLER = 'caller-user';
	const EMPLOYEE = 'caller-employee';
	const MANAGED_TEAM = { id: 'team-managed', name: 'Managed' };
	const OTHER_TEAM = { id: 'team-other', name: 'Other' };
	const DELETED_TEAM = { id: 'team-deleted', name: 'Deleted' };
	const INVITE_PERMISSIONS = [PermissionsEnum.ORG_INVITE_VIEW, PermissionsEnum.ORG_INVITE_EDIT];

	/** The metadata of `Invite.teams` the register reads its pivot from, quoted as PostgreSQL and SQLite quote. */
	const INVITE_METADATA = {
		dataSource: { driver: { escape: (identifier: string) => `"${identifier}"` } },
		findRelationWithPropertyPath: () => ({
			junctionEntityMetadata: {
				tablePath: 'invite_organization_team',
				ownerColumns: [{ databaseName: 'inviteId' }],
				inverseColumns: [{ databaseName: 'organizationTeamId' }]
			}
		})
	};

	/** The invitations of one of the managed teams, as the register states them for the column `"invite"."id"`. */
	const LINKED_TO_ONE_OF =
		'"invite"."id" IN (SELECT "invite_teams_reach"."inviteId" FROM "invite_organization_team" "invite_teams_reach" ' +
		'WHERE "invite_teams_reach"."organizationTeamId" IN (:...inviteTeamsInReach))';

	/** The invitations no row of the pivot links to a team, as the register states them for the same column. */
	const LINKED_TO_NO_TEAM =
		'NOT EXISTS (SELECT 1 FROM "invite_organization_team" "invite_teams_reach" ' +
		'WHERE "invite_teams_reach"."inviteId" = "invite"."id")';

	/**
	 * Signs the caller in as `JwtStrategy` attaches them to the request, with their employee and their permissions.
	 *
	 * @param employeeId - The caller's employee, or null for a user without one.
	 * @param permissions - The permissions of the caller's role.
	 */
	function signIn(employeeId: string | null, permissions: PermissionsEnum[] = INVITE_PERMISSIONS) {
		const user = { id: CALLER, tenantId: TENANT, lastOrganizationId: ORGANIZATION, employeeId, permissions };
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as never);
	}

	/**
	 * The service, with what the invitation flows read stood in for.
	 *
	 * @param managedTeams - The teams the caller manages, which the read of their teams answers among the ones it names.
	 */
	function build(managedTeams: { id: string }[] = []) {
		const findTeams = jest.fn(async (options: { where: { id?: FindOperator<string> }[] }) => {
			const named = options.where[0].id;
			if (!named) {
				return managedTeams;
			}
			const namedIds = named.value as unknown as string[];
			return managedTeams.filter((team) => namedIds.includes(team.id));
		});
		const emailService = { inviteTeamMember: jest.fn(), inviteUser: jest.fn(), inviteEmployee: jest.fn() };
		const saveMany = jest.fn(async (invites: unknown[]) => invites);
		const inviter = { id: CALLER, role: { name: RolesEnum.EMPLOYEE } };
		const organization = { id: ORGANIZATION, inviteExpiryPeriod: 7 };

		const service: InviteService = Object.create(InviteService.prototype);
		Object.assign(service, {
			logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
			configService: { get: () => 'https://app.gauzy.co' },
			emailService,
			organizationTeamService: { find: findTeams },
			userService: { findOneByIdString: jest.fn(async () => inviter) },
			roleService: { find: jest.fn(async () => []) },
			organizationService: { findOneByIdString: jest.fn(async () => organization) },
			findAll: jest.fn(async () => ({ items: [], total: 0 })),
			typeOrmOrganizationTeamEmployeeRepository: { findBy: jest.fn(async () => []) },
			typeOrmRepository: { metadata: INVITE_METADATA },
			saveMany
		});
		return { service, findTeams, emailService, saveMany };
	}

	/**
	 * The read of the teams the caller manages: the ones a manager membership of their employee names, and the ones
	 * they created, among `teamIds` when they are named.
	 */
	function managedTeamsRead(teamIds?: string[]) {
		const named: Record<string, unknown> = {};
		if (teamIds) {
			named['id'] = In(teamIds);
		}
		const managerRoles = In([RolesEnum.MANAGER, RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN]);
		return {
			select: { id: true },
			where: [
				{ ...named, members: { employeeId: EMPLOYEE, isManager: true } },
				{ ...named, members: { employeeId: EMPLOYEE, role: { name: managerRoles } } },
				{ ...named, createdByUserId: CALLER }
			]
		};
	}

	/** An invitation of the given teams, as the service reads it with its teams. */
	function invitationOf(teams: ISpecTeam[]) {
		return {
			id: 'invite-1',
			email: 'new@ever.co',
			organization: { id: ORGANIZATION, tenantId: TENANT },
			role: { name: RolesEnum.EMPLOYEE },
			teams
		};
	}

	/**
	 * The service's read of an invitation's teams before a resend or a delete, soft-deleted teams included.
	 *
	 * @param service - The service.
	 * @param teams - The teams the read answers.
	 */
	function readsTeamsOf(service: InviteService, teams: ISpecTeam[]) {
		const read = jest.fn(async () => ({ success: true, record: invitationOf(teams) }));
		Object.assign(service, { findOneOrFailByOptions: read });
		return read;
	}

	/** The read of an invitation's teams the resend and the delete check it with. */
	const TEAMS_OF_INVITATION_READ = { where: { id: 'invite-1' }, relations: { teams: true }, withDeleted: true };

	/** The SQL a raw condition of the register states on the invitation's id, as TypeORM renders it. */
	function sqlOf(condition: unknown): string {
		const operator = condition as FindOperator<string>;
		return operator.getSql('"invite"."id"');
	}

	/** The parameters a raw condition of the register binds: the teams it keeps the invitations of. */
	function parametersOf(condition: unknown) {
		const operator = condition as FindOperator<string>;
		return operator.objectLiteralParameters;
	}

	afterEach(() => jest.restoreAllMocks());

	describe('findAllInvites', () => {
		let findAll: jest.SpyInstance;
		let findInvites: jest.SpyInstance;

		beforeEach(() => {
			findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [], total: 0 });
			findInvites = jest.spyOn(TenantAwareCrudService.prototype, 'find').mockResolvedValue([]);
		});

		/** The conditions the register was read with. */
		function registerWhere(): Record<string, unknown>[] {
			const [[options]] = findAll.mock.calls as [[{ where: Record<string, unknown>[] }]];
			return options.where;
		}

		it('keeps an employee to the invitations of the teams they manage, and of no team, in the database', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams } = build([MANAGED_TEAM]);

			await service.findAllInvites({} as never);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead());
			// No invitation is read ahead of the register: a page reads its rows, whatever the teams' history.
			expect(findInvites).not.toHaveBeenCalled();
			const [ofManagedTeam, ofNoTeam] = registerWhere();
			expect(ofManagedTeam.tenantId).toBe(TENANT);
			expect(sqlOf(ofManagedTeam.id)).toBe(LINKED_TO_ONE_OF);
			expect(parametersOf(ofManagedTeam.id)).toEqual({ inviteTeamsInReach: [MANAGED_TEAM.id] });
			expect(ofNoTeam.tenantId).toBe(TENANT);
			expect(ofNoTeam.teams).toBeUndefined();
			expect(sqlOf(ofNoTeam.id)).toBe(LINKED_TO_NO_TEAM);
		});

		it('answers no invitation for a team the employee does not manage', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams } = build([]);

			await service.findAllInvites({ where: { teams: { id: [OTHER_TEAM.id] } } } as never);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead([OTHER_TEAM.id]));
			expect(findAll).toHaveBeenCalledWith({
				where: [{ tenantId: TENANT, teams: { id: In([OTHER_TEAM.id]) }, id: In([]) }]
			});
		});

		it('reads a team the employee manages as it was read before, as Ever Teams lists it', async () => {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);

			await service.findAllInvites({ where: { teams: { id: [MANAGED_TEAM.id] } } } as never);

			const where = registerWhere();
			expect(where).toHaveLength(1);
			expect(where[0].teams).toEqual({ id: In([MANAGED_TEAM.id]) });
			expect(sqlOf(where[0].id)).toBe(LINKED_TO_ONE_OF);
		});

		it('keeps an invitation the request names to the one it names, in reach', async () => {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);

			await service.findAllInvites({ where: { id: 'invite-managed' } } as never);

			const [ofManagedTeam] = registerWhere();
			const namedAndInReach = ofManagedTeam.id as FindOperator<FindOperator<string>[]>;
			const [named, inReach] = namedAndInReach.value;
			expect(named.value).toBe('invite-managed');
			expect(sqlOf(inReach)).toBe(LINKED_TO_ONE_OF);
		});

		it('reads the teams a caller without an employee created, whatever permissions they hold now', async () => {
			signIn(null);
			const { service, findTeams } = build([]);

			await service.findAllInvites({} as never);

			expect(findTeams).toHaveBeenCalledWith({ select: { id: true }, where: [{ createdByUserId: CALLER }] });
			const [ofManagedTeam, ofNoTeam] = registerWhere();
			expect(ofManagedTeam.id).toEqual(In([]));
			expect(sqlOf(ofNoTeam.id)).toBe(LINKED_TO_NO_TEAM);
		});

		it('keeps a team creator without an employee, nor ORG_TEAM_ADD any more, to the teams they created', async () => {
			signIn(null);
			const { service, findTeams } = build([MANAGED_TEAM]);

			await service.findAllInvites({} as never);

			expect(findTeams).toHaveBeenCalledWith({ select: { id: true }, where: [{ createdByUserId: CALLER }] });
			const [ofManagedTeam] = registerWhere();
			expect(parametersOf(ofManagedTeam.id)).toEqual({ inviteTeamsInReach: [MANAGED_TEAM.id] });
		});

		it.each([PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE])(
			'keeps the whole register for a holder of %s',
			async (grant) => {
				signIn(EMPLOYEE, [...INVITE_PERMISSIONS, grant]);
				const { service, findTeams } = build([MANAGED_TEAM]);

				await service.findAllInvites({} as never);

				expect(findTeams).not.toHaveBeenCalled();
				expect(findAll).toHaveBeenCalledWith({ where: [{ tenantId: TENANT }] });
			}
		);
	});

	describe('resendEmail', () => {
		let update: jest.SpyInstance;

		beforeEach(() => {
			// `super.update` at the end of resendEmail.
			update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as never);
		});

		/** Resends the team invitation of the given teams, read live for the email. */
		function resend(service: InviteService, teams: ISpecTeam[]) {
			const invitation = invitationOf(teams);
			Object.assign(service, { findOneByIdString: jest.fn(async () => invitation) });
			const input = { inviteId: 'invite-1', inviteType: InvitationTypeEnum.TEAM };
			return service.resendEmail(input as never, 'en' as never);
		}

		it('refuses an employee the invitation of a team they do not manage, and mails nothing', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, emailService } = build([]);
			readsTeamsOf(service, [OTHER_TEAM]);

			await expect(resend(service, [OTHER_TEAM])).rejects.toBeInstanceOf(ForbiddenException);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead([OTHER_TEAM.id]));
			expect(emailService.inviteTeamMember).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it('refuses a manager of only one of its teams, since the new token is for all of them', async () => {
			signIn(EMPLOYEE);
			const { service, emailService } = build([MANAGED_TEAM]);
			readsTeamsOf(service, [MANAGED_TEAM, OTHER_TEAM]);

			await expect(resend(service, [MANAGED_TEAM, OTHER_TEAM])).rejects.toBeInstanceOf(ForbiddenException);

			expect(emailService.inviteTeamMember).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it('lets a manager of every one of its teams resend it', async () => {
			signIn(EMPLOYEE);
			const { service, emailService } = build([MANAGED_TEAM]);
			const read = readsTeamsOf(service, [MANAGED_TEAM]);

			await resend(service, [MANAGED_TEAM]);

			expect(read).toHaveBeenCalledWith(TEAMS_OF_INVITATION_READ);
			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledTimes(1);
		});

		it('lets an employee resend an invitation of no team, as before', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, emailService } = build([]);
			readsTeamsOf(service, []);

			await resend(service, []);

			expect(findTeams).not.toHaveBeenCalled();
			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
		});

		it('refuses an invitation whose team is soft-deleted, which the live read shows with no team', async () => {
			signIn(EMPLOYEE);
			const { service, emailService } = build([]);
			readsTeamsOf(service, [DELETED_TEAM]);

			await expect(resend(service, [])).rejects.toBeInstanceOf(ForbiddenException);

			expect(emailService.inviteTeamMember).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it('resends for an admin without reading the teams again', async () => {
			signIn(EMPLOYEE, [...INVITE_PERMISSIONS, PermissionsEnum.ALL_ORG_EDIT]);
			const { service, emailService } = build([]);
			const read = readsTeamsOf(service, [OTHER_TEAM]);

			await resend(service, [OTHER_TEAM]);

			expect(read).not.toHaveBeenCalled();
			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
		});
	});

	describe('delete', () => {
		let remove: jest.SpyInstance;

		beforeEach(() => {
			remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		});

		it('refuses an employee the invitation of a team they do not manage, and deletes nothing', async () => {
			signIn(EMPLOYEE);
			const { service } = build([]);
			readsTeamsOf(service, [OTHER_TEAM]);

			await expect(service.delete('invite-1')).rejects.toBeInstanceOf(ForbiddenException);

			expect(remove).not.toHaveBeenCalled();
		});

		it('refuses a manager of only one of its teams, since the delete cancels it for all of them', async () => {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);
			readsTeamsOf(service, [MANAGED_TEAM, OTHER_TEAM]);

			await expect(service.delete('invite-1')).rejects.toBeInstanceOf(ForbiddenException);

			expect(remove).not.toHaveBeenCalled();
		});

		it('lets a manager of its team delete it', async () => {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);
			const read = readsTeamsOf(service, [MANAGED_TEAM]);

			await service.delete('invite-1');

			expect(read).toHaveBeenCalledWith(TEAMS_OF_INVITATION_READ);
			expect(remove).toHaveBeenCalledWith('invite-1', undefined);
		});

		it('lets an employee delete an invitation of no team, as before', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams } = build([]);
			readsTeamsOf(service, []);

			await service.delete('invite-1');

			expect(findTeams).not.toHaveBeenCalled();
			expect(remove).toHaveBeenCalledWith('invite-1', undefined);
		});

		it('deletes nothing unchecked when the invitation cannot be read', async () => {
			signIn(EMPLOYEE);
			const { service } = build([]);
			const read = jest.fn(async () => ({ success: false, error: new Error('read failed') }));
			Object.assign(service, { findOneOrFailByOptions: read });

			const result = await service.delete('invite-1');

			expect(result).toEqual({ raw: [], affected: 0 });
			expect(remove).not.toHaveBeenCalled();
		});

		it('deletes for an admin without reading the invitation', async () => {
			signIn(EMPLOYEE, [...INVITE_PERMISSIONS, PermissionsEnum.ALL_ORG_EDIT]);
			const { service } = build([]);
			const read = readsTeamsOf(service, [OTHER_TEAM]);

			await service.delete('invite-1');

			expect(read).not.toHaveBeenCalled();
			expect(remove).toHaveBeenCalledWith('invite-1', undefined);
		});
	});

	describe('createBulk', () => {
		/** Sends one team invitation into the given teams, as Ever Teams does. */
		function invite(service: InviteService, teams: ISpecTeam[]) {
			const relations = { projects: [], departments: [], organizationContacts: [], organizationTeams: teams };
			Object.assign(service, { fetchInvitesRelations: jest.fn(async () => relations) });
			const input = {
				emailIds: ['new@ever.co'],
				teamIds: teams.map((team) => team.id),
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				inviteType: InvitationTypeEnum.TEAM
			};
			return service.createBulk(input as never, 'en' as never);
		}

		it('refuses an employee an invitation into a team they do not manage, and writes nothing', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, saveMany, emailService } = build([MANAGED_TEAM]);

			await expect(invite(service, [MANAGED_TEAM, OTHER_TEAM])).rejects.toBeInstanceOf(ForbiddenException);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead([MANAGED_TEAM.id, OTHER_TEAM.id]));
			expect(saveMany).not.toHaveBeenCalled();
			expect(emailService.inviteTeamMember).not.toHaveBeenCalled();
		});

		it('lets a manager invite into the team they manage', async () => {
			signIn(EMPLOYEE);
			const { service, saveMany, emailService } = build([MANAGED_TEAM]);

			await invite(service, [MANAGED_TEAM]);

			const [[invites]] = saveMany.mock.calls as unknown as [[{ teams: unknown[] }[]]];
			expect(invites).toHaveLength(1);
			expect(invites[0].teams).toEqual([MANAGED_TEAM]);
			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
		});

		it('lets an employee send an invitation into no team, as before', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, saveMany } = build([]);

			await invite(service, []);

			expect(findTeams).not.toHaveBeenCalled();
			expect(saveMany).toHaveBeenCalledTimes(1);
		});
	});

	/**
	 * The invitations, the teams and the caller's memberships as each ORM reads them, on an in-memory better-sqlite3
	 * store of its own, through the CRUD base, so the reads of the teams the caller manages run as written: a member
	 * flagged `isManager`, a member holding a manager's team role, the team's creator, and nothing for a plain member.
	 */
	describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('the invitation flows as %s reads them', (orm) => {
		const ROLE_MANAGED_TEAM = { id: 'team-role-managed', name: 'Managed by role' };
		const CREATED_TEAM = { id: 'team-created', name: 'Created' };
		const MEMBER_TEAM = { id: 'team-member', name: 'Member' };

		/** The teams stored, with their creator and whether they are soft-deleted. */
		const TEAMS = [
			{ team: MANAGED_TEAM },
			{ team: ROLE_MANAGED_TEAM },
			{ team: CREATED_TEAM, createdByUserId: CALLER },
			{ team: MEMBER_TEAM },
			{ team: OTHER_TEAM },
			{ team: DELETED_TEAM, deletedAt: '2026-10-01 00:00:00' }
		];

		/** The team roles the memberships hold. */
		const ROLES = [
			{ id: 'role-manager', name: RolesEnum.MANAGER },
			{ id: 'role-employee', name: RolesEnum.EMPLOYEE }
		];

		/** The caller's memberships: a manager by the flag, a manager by the team role, and a plain member. */
		const MEMBERSHIPS = [
			{ id: 'member-flagged', teamId: MANAGED_TEAM.id, isManager: 1, roleId: null },
			{ id: 'member-by-role', teamId: ROLE_MANAGED_TEAM.id, isManager: 0, roleId: 'role-manager' },
			{ id: 'member-plain', teamId: MEMBER_TEAM.id, isManager: 0, roleId: 'role-employee' }
		];

		/** The invitations stored, by the teams each one names. */
		const INVITES = [
			{ id: 'invite-no-team', email: 'no-team@ever.co', teamIds: [] as string[] },
			{ id: 'invite-managed', email: 'managed@ever.co', teamIds: [MANAGED_TEAM.id] },
			{ id: 'invite-role-managed', email: 'role-managed@ever.co', teamIds: [ROLE_MANAGED_TEAM.id] },
			{ id: 'invite-created', email: 'created@ever.co', teamIds: [CREATED_TEAM.id] },
			{ id: 'invite-member', email: 'member@ever.co', teamIds: [MEMBER_TEAM.id] },
			{ id: 'invite-other', email: 'other@ever.co', teamIds: [OTHER_TEAM.id] },
			{ id: 'invite-both', email: 'both@ever.co', teamIds: [MANAGED_TEAM.id, OTHER_TEAM.id] },
			{ id: 'invite-other-deleted', email: 'other-deleted@ever.co', teamIds: [OTHER_TEAM.id, DELETED_TEAM.id] },
			{ id: 'invite-deleted', email: 'deleted@ever.co', teamIds: [DELETED_TEAM.id] }
		];

		let invites: SpecStore;
		let teams: SpecStore;
		let inviteRepository: unknown;
		let close: () => Promise<void>;

		/** Writes the roles, the teams, the memberships, the invitations and the pivot rows through the store's connection. */
		async function seed(execute: (sql: string, params: unknown[]) => Promise<unknown>) {
			for (const role of ROLES) {
				await execute('INSERT INTO role (id, name) VALUES (?, ?)', [role.id, role.name]);
			}
			for (const { team, createdByUserId = null, deletedAt = null } of TEAMS) {
				const insertTeam =
					'INSERT INTO organization_team (id, name, createdByUserId, deletedAt) VALUES (?, ?, ?, ?)';
				await execute(insertTeam, [team.id, team.name, createdByUserId, deletedAt]);
			}
			for (const member of MEMBERSHIPS) {
				const columns = 'id, organizationTeamId, employeeId, isManager, roleId';
				const insertMember = `INSERT INTO organization_team_employee (${columns}) VALUES (?, ?, ?, ?, ?)`;
				await execute(insertMember, [member.id, member.teamId, EMPLOYEE, member.isManager, member.roleId]);
			}
			for (const row of INVITES) {
				await execute('INSERT INTO invite (id, email, tenantId) VALUES (?, ?, ?)', [row.id, row.email, TENANT]);
				for (const teamId of row.teamIds) {
					const pivot = 'INSERT INTO invite_organization_team (inviteId, organizationTeamId) VALUES (?, ?)';
					await execute(pivot, [row.id, teamId]);
				}
			}
		}

		/** The TypeORM store: the tables as TypeORM synchronizes them, with the platform's handling of null values. */
		async function openTypeOrmStore() {
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database: ':memory:',
				entities: [TYPEORM_ROLE, TYPEORM_TEAM, TYPEORM_MEMBER, TYPEORM_INVITE],
				synchronize: true,
				logging: false,
				invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
			});
			await dataSource.initialize();
			await seed((sql, params) => dataSource.query(sql, params));
			inviteRepository = dataSource.getRepository(TYPEORM_INVITE);
			invites = new SpecStore(inviteRepository as never, {} as never);
			teams = new SpecStore(dataSource.getRepository(TYPEORM_TEAM), {} as never);
			close = () => dataSource.destroy();
		}

		/** The MikroORM store, opened with the join and naming options the platform's MikroORM runs with. */
		async function openMikroOrmStore() {
			const mikroOrm = await MikroORM.init<BetterSqliteDriver>({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [MIKRO_ORM_ROLE, MIKRO_ORM_TEAM, MIKRO_ORM_MEMBER, MIKRO_ORM_INVITE],
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true
			});
			await mikroOrm.schema.createSchema();
			const connection = mikroOrm.em.getConnection();
			await seed((sql, params) => connection.execute(sql, params as never[]));
			const inviteMikroOrmRepository = new MikroOrmBaseEntityRepository(
				mikroOrm.em.fork() as never,
				MikroOrmInvite
			);
			const teamMikroOrmRepository = new MikroOrmBaseEntityRepository(
				mikroOrm.em.fork() as never,
				MikroOrmInviteTeam
			);
			invites = new SpecStore({} as never, inviteMikroOrmRepository as never);
			teams = new SpecStore({} as never, teamMikroOrmRepository as never);
			close = () => mikroOrm.close(true);
		}

		beforeAll(async () => {
			if (orm === MultiORMEnum.TypeORM) {
				await openTypeOrmStore();
				return;
			}
			await openMikroOrmStore();
		});

		afterAll(async () => {
			await close?.();
		});

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(orm);
			jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockImplementation((options) =>
				invites.findAll(options as never)
			);
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneOrFailByOptions').mockImplementation((options) =>
				invites.findOneOrFailByOptions(options as never)
			);
		});

		/** The service, reading the caller's teams and the invitations' pivot from the stores. */
		function buildOnStores(): InviteService {
			const { service } = build();
			Object.assign(service, { organizationTeamService: teams, typeOrmRepository: inviteRepository });
			return service;
		}

		/** The addresses of the invitations the caller lists, sorted. */
		async function listed(options: object): Promise<string[]> {
			const service = buildOnStores();
			const { items } = await service.findAllInvites(options as never);
			const emails = items.map((item) => item.email);
			emails.sort((left, right) => left.localeCompare(right));
			return emails;
		}

		it('lists the invitations of the teams the caller manages by flag, by team role and as creator, and of no team', async () => {
			signIn(EMPLOYEE);

			const emails = await listed({});

			// Not the plain membership's, nor the other team's, nor the deleted team's.
			const expected = [
				'both@ever.co',
				'created@ever.co',
				'managed@ever.co',
				'no-team@ever.co',
				'role-managed@ever.co'
			];
			expect(emails).toEqual(expected);
		});

		it('does not list an invitation of an unmanaged team as one of no team because its other team is deleted', async () => {
			signIn(EMPLOYEE);

			const emails = await listed({});

			expect(emails).not.toContain('other-deleted@ever.co');
			expect(emails).not.toContain('deleted@ever.co');
		});

		it('lists a creator without an employee the invitations of the teams they created, and of no team', async () => {
			signIn(null);

			const emails = await listed({});

			expect(emails).toEqual(['created@ever.co', 'no-team@ever.co']);
		});

		it('lists nothing for a team the caller does not manage', async () => {
			signIn(EMPLOYEE);

			const emails = await listed({ where: { teams: { id: [OTHER_TEAM.id] } } });

			expect(emails).toEqual([]);
		});

		it('lists the managed team as before', async () => {
			signIn(EMPLOYEE);

			const emails = await listed({ where: { teams: { id: [MANAGED_TEAM.id] } } });

			expect(emails).toEqual(['both@ever.co', 'managed@ever.co']);
		});

		it('lists the invitation a request names when it is in reach, and nothing when it is not', async () => {
			signIn(EMPLOYEE);

			const inReach = await listed({ where: { id: 'invite-managed' } });
			const outOfReach = await listed({ where: { id: 'invite-other' } });

			expect(inReach).toEqual(['managed@ever.co']);
			expect(outOfReach).toEqual([]);
		});

		it('keeps every team of an invitation it lists, the ones the caller does not manage included', async () => {
			signIn(EMPLOYEE);
			const service = buildOnStores();

			const { items } = await service.findAllInvites({ relations: { teams: true } } as never);

			const ofBothTeams = items.find((item) => item.id === 'invite-both');
			const teamIds = ofBothTeams.teams.map((team) => team.id);
			teamIds.sort((left, right) => left.localeCompare(right));
			expect(teamIds).toEqual([MANAGED_TEAM.id, OTHER_TEAM.id]);
		});

		it('reads a page of the invitations in reach with their teams, and counts them all', async () => {
			signIn(EMPLOYEE);
			const service = buildOnStores();

			const { items, total } = await service.findAllInvites({
				take: 2,
				skip: 1,
				relations: { teams: true }
			} as never);

			const inReach = [
				'invite-both',
				'invite-created',
				'invite-managed',
				'invite-no-team',
				'invite-role-managed'
			];
			expect(total).toBe(inReach.length);
			expect(items).toHaveLength(2);
			for (const item of items) {
				expect(inReach).toContain(item.id);
			}
		});

		describe('delete', () => {
			let remove: jest.SpyInstance;

			beforeEach(() => {
				remove = jest
					.spyOn(TenantAwareCrudService.prototype, 'delete')
					.mockResolvedValue({ affected: 1, raw: [] });
			});

			it('lets a manager of every team of the invitation delete it', async () => {
				signIn(EMPLOYEE);

				await buildOnStores().delete('invite-managed');

				expect(remove).toHaveBeenCalledWith('invite-managed', undefined);
			});

			it('refuses the invitation of a soft-deleted team, read with that team rather than as one of no team', async () => {
				signIn(EMPLOYEE);

				await expect(buildOnStores().delete('invite-deleted')).rejects.toBeInstanceOf(ForbiddenException);

				expect(remove).not.toHaveBeenCalled();
			});
		});
	});
});
