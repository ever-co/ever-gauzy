/**
 * This import must stay FIRST, before any import that pulls a core service or handler: the
 * entity graph has to finish initializing before anything applies the custom validators.
 * See invite-accept.security.spec.ts.
 */
import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema as TypeOrmEntitySchema, FindOperator, In, IsNull } from 'typeorm';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { InvitationTypeEnum, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { BaseEntity } from '../core/entities/base.entity';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORMEnum } from '../core/utils';
import { InviteService } from './invite.service';

/** A team, as far as the register reads it. */
interface ISpecTeam {
	id: string;
	name: string;
}

/** An invitation, as far as the register reads it. */
interface ISpecInvite {
	id: string;
	email: string;
	tenantId: string;
	teams?: ISpecTeam[];
}

/** A store of invitations, read through the CRUD base as `InviteService` reads them. */
class InviteStore extends CrudService<BaseEntity> {}

/** The team table; soft-deletable, as `organization_team` is, so TypeORM joins only the teams not deleted. */
const TYPEORM_TEAM = new TypeOrmEntitySchema<ISpecTeam & { deletedAt?: Date }>({
	name: 'InviteRegisterTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
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
}

class MikroOrmInvite {
	id!: string;
	email!: string;
	tenantId!: string;
	teams?: unknown;
}

const MIKRO_ORM_TEAM = new MikroOrmEntitySchema<MikroOrmInviteTeam>({
	class: MikroOrmInviteTeam,
	tableName: 'organization_team',
	properties: {
		id: { type: 'string', primary: true },
		name: { type: 'string' }
	}
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
 * as they were, and so does a call without a request user.
 */
describe('InviteService - the invitations of a team are handled by its managers', () => {
	const TENANT = 'tenant-1';
	const ORGANIZATION = 'organization-1';
	const CALLER = 'caller-user';
	const EMPLOYEE = 'caller-employee';
	const MANAGED_TEAM = { id: 'team-managed', name: 'Managed' };
	const OTHER_TEAM = { id: 'team-other', name: 'Other' };
	/** The invitations of the managed team, as the read of a team's invitations answers them. */
	const MANAGED_TEAM_INVITES = [{ id: 'invite-managed' }];
	const INVITE_PERMISSIONS = [PermissionsEnum.ORG_INVITE_VIEW, PermissionsEnum.ORG_INVITE_EDIT];

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

	afterEach(() => jest.restoreAllMocks());

	describe('findAllInvites', () => {
		let findAll: jest.SpyInstance;
		let findInvites: jest.SpyInstance;

		beforeEach(() => {
			findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [], total: 0 });
			// The read of the managed teams' invitations, whose ids the register is kept to.
			findInvites = jest
				.spyOn(TenantAwareCrudService.prototype, 'find')
				.mockResolvedValue(MANAGED_TEAM_INVITES as never);
		});

		it('keeps an employee to the invitations of the teams they manage, and of no team', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams } = build([MANAGED_TEAM]);

			await service.findAllInvites({} as never);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead());
			expect(findInvites).toHaveBeenCalledWith({
				select: { id: true },
				where: { teams: { id: In([MANAGED_TEAM.id]) } }
			});
			expect(findAll).toHaveBeenCalledWith({
				where: [
					{ tenantId: TENANT, id: In(['invite-managed']) },
					{ tenantId: TENANT, teams: { id: IsNull() } }
				]
			});
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

			expect(findAll).toHaveBeenCalledWith({
				where: [{ tenantId: TENANT, teams: { id: In([MANAGED_TEAM.id]) }, id: In(['invite-managed']) }]
			});
		});

		it('leaves a caller without an employee the invitations of no team, without reading any team', async () => {
			signIn(null);
			const { service, findTeams } = build([MANAGED_TEAM]);

			await service.findAllInvites({} as never);

			expect(findTeams).not.toHaveBeenCalled();
			expect(findAll).toHaveBeenCalledWith({
				where: [
					{ tenantId: TENANT, id: In([]) },
					{ tenantId: TENANT, teams: { id: IsNull() } }
				]
			});
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

		/** Resends the team invitation of the given teams. */
		function resend(service: InviteService, teams: ISpecTeam[]) {
			const invitation = invitationOf(teams);
			Object.assign(service, { findOneByIdString: jest.fn(async () => invitation) });
			const input = { inviteId: 'invite-1', inviteType: InvitationTypeEnum.TEAM };
			return service.resendEmail(input as never, 'en' as never);
		}

		it('refuses an employee the invitation of a team they do not manage, and mails nothing', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, emailService } = build([]);

			await expect(resend(service, [OTHER_TEAM])).rejects.toBeInstanceOf(ForbiddenException);

			expect(findTeams).toHaveBeenCalledWith(managedTeamsRead([OTHER_TEAM.id]));
			expect(emailService.inviteTeamMember).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
		});

		it('lets a manager of one of its teams resend it', async () => {
			signIn(EMPLOYEE);
			const { service, emailService } = build([MANAGED_TEAM]);

			await resend(service, [MANAGED_TEAM, OTHER_TEAM]);

			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
			expect(update).toHaveBeenCalledTimes(1);
		});

		it('lets an employee resend an invitation of no team, as before', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams, emailService } = build([]);

			await resend(service, []);

			expect(findTeams).not.toHaveBeenCalled();
			expect(emailService.inviteTeamMember).toHaveBeenCalledTimes(1);
		});
	});

	describe('delete', () => {
		let remove: jest.SpyInstance;

		beforeEach(() => {
			remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		});

		/** The service, reading the invitation of the given teams. */
		function withInvitation(teams: ISpecTeam[], managedTeams: { id: string }[]) {
			const built = build(managedTeams);
			const invitation = invitationOf(teams);
			const read = jest.fn(async () => ({ success: true, record: invitation }));
			Object.assign(built.service, { findOneOrFailByIdString: read });
			return { ...built, read };
		}

		it('refuses an employee the invitation of a team they do not manage, and deletes nothing', async () => {
			signIn(EMPLOYEE);
			const { service } = withInvitation([OTHER_TEAM], []);

			await expect(service.delete('invite-1')).rejects.toBeInstanceOf(ForbiddenException);

			expect(remove).not.toHaveBeenCalled();
		});

		it('lets a manager of its team delete it', async () => {
			signIn(EMPLOYEE);
			const { service, read } = withInvitation([MANAGED_TEAM], [MANAGED_TEAM]);

			await service.delete('invite-1');

			expect(read).toHaveBeenCalledWith('invite-1', { relations: { teams: true } });
			expect(remove).toHaveBeenCalledWith('invite-1', undefined);
		});

		it('lets an employee delete an invitation of no team, as before', async () => {
			signIn(EMPLOYEE);
			const { service, findTeams } = withInvitation([], []);

			await service.delete('invite-1');

			expect(findTeams).not.toHaveBeenCalled();
			expect(remove).toHaveBeenCalledWith('invite-1', undefined);
		});

		it('deletes for an admin without reading the invitation', async () => {
			signIn(EMPLOYEE, [...INVITE_PERMISSIONS, PermissionsEnum.ALL_ORG_EDIT]);
			const { service, read } = withInvitation([OTHER_TEAM], []);

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
	 * The register as each ORM reads it, on an in-memory better-sqlite3 store of its own: the invitation, its teams and
	 * the pivot table between them. Both alternatives the register is narrowed to name the team's id alone, and an
	 * invitation of no team is the one its join leaves without a team.
	 */
	describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('the register as %s reads it', (orm) => {
		/** The invitations stored, by the teams each one names. */
		const INVITES = [
			{ id: 'invite-no-team', email: 'no-team@ever.co', teamIds: [] as string[] },
			{ id: 'invite-managed', email: 'managed@ever.co', teamIds: [MANAGED_TEAM.id] },
			{ id: 'invite-other', email: 'other@ever.co', teamIds: [OTHER_TEAM.id] },
			{ id: 'invite-both', email: 'both@ever.co', teamIds: [MANAGED_TEAM.id, OTHER_TEAM.id] }
		];

		let store: InviteStore;
		let close: () => Promise<void>;

		/** Writes the teams, the invitations and the pivot rows through the store's own connection. */
		async function seed(execute: (sql: string, params: unknown[]) => Promise<unknown>) {
			for (const team of [MANAGED_TEAM, OTHER_TEAM]) {
				await execute('INSERT INTO organization_team (id, name) VALUES (?, ?)', [team.id, team.name]);
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
				entities: [TYPEORM_TEAM, TYPEORM_INVITE],
				synchronize: true,
				logging: false,
				invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
			});
			await dataSource.initialize();
			await seed((sql, params) => dataSource.query(sql, params));
			store = new InviteStore(dataSource.getRepository(TYPEORM_INVITE), {} as never);
			close = () => dataSource.destroy();
		}

		/** The MikroORM store, opened with the join and naming options the platform's MikroORM runs with. */
		async function openMikroOrmStore() {
			const mikroOrm = await MikroORM.init<BetterSqliteDriver>({
				driver: BetterSqliteDriver,
				dbName: ':memory:',
				entities: [MIKRO_ORM_TEAM, MIKRO_ORM_INVITE],
				autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				namingStrategy: EntityCaseNamingStrategy,
				allowGlobalContext: true
			});
			await mikroOrm.schema.createSchema();
			const connection = mikroOrm.em.getConnection();
			await seed((sql, params) => connection.execute(sql, params as never[]));
			const repository = new MikroOrmBaseEntityRepository(mikroOrm.em.fork() as never, MikroOrmInvite);
			store = new InviteStore({} as never, repository as never);
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
				store.findAll(options as never)
			);
			jest.spyOn(TenantAwareCrudService.prototype, 'find').mockImplementation((options) =>
				store.find(options as never)
			);
		});

		/** The addresses of the invitations a manager of the managed team lists. */
		async function listed(options: object): Promise<string[]> {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);
			const { items } = await service.findAllInvites(options as never);
			const emails = items.map((item) => item.email);
			emails.sort((left, right) => left.localeCompare(right));
			return emails;
		}

		it('lists the invitations of the managed team and of no team, and no other', async () => {
			const emails = await listed({});

			expect(emails).toEqual(['both@ever.co', 'managed@ever.co', 'no-team@ever.co']);
		});

		it('lists nothing for a team the caller does not manage', async () => {
			const emails = await listed({ where: { teams: { id: [OTHER_TEAM.id] } } });

			expect(emails).toEqual([]);
		});

		it('lists the managed team as before', async () => {
			const emails = await listed({ where: { teams: { id: [MANAGED_TEAM.id] } } });

			expect(emails).toEqual(['both@ever.co', 'managed@ever.co']);
		});

		it('keeps every team of an invitation it lists, the ones the caller does not manage included', async () => {
			signIn(EMPLOYEE);
			const { service } = build([MANAGED_TEAM]);

			const { items } = await service.findAllInvites({ relations: { teams: true } } as never);

			const ofBothTeams = items.find((item) => item.id === 'invite-both');
			const teamIds = ofBothTeams.teams.map((team) => team.id);
			teamIds.sort((left, right) => left.localeCompare(right));
			expect(teamIds).toEqual([MANAGED_TEAM.id, OTHER_TEAM.id]);
		});
	});
});
