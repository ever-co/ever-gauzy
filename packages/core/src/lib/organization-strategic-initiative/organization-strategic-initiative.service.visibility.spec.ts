import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { OrganizationStrategicVisibilityScopeEnum, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { UserOrganization } from '../core/entities/internal';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION = 'b0000000-0000-4000-8000-0000000000ff';
const TEAM = 'c0000000-0000-4000-8000-00000000000a';
const STEWARD = 'e0000000-0000-4000-8000-0000000000aa';
const OTHER = 'e0000000-0000-4000-8000-0000000000bb';
const USER = 'f0000000-0000-4000-8000-000000000001';

/**
 * Who sees an initiative (G-P2-4 visibility rule; local Gauzy ↔ Ever Works e2e, matrix row 12): a team-scoped
 * initiative an Ever Works Mission became answered 404 to its own steward, an admin who is not on the team.
 * `RequestContext.currentEmployeeId()` is empty for a user who may act for every employee
 * (`CHANGE_SELECTED_EMPLOYEE`), so the steward check never matched an admin — nor did their team membership.
 *
 * The rule now reads the caller's own employee, and an organization admin who may edit initiatives (may act for
 * every employee and holds `ORG_STRATEGIC_INITIATIVE_UPDATE`) sees every initiative of the organizations they are
 * a member of — never another organization of the tenant. REST and GraphQL read through the same query
 * handlers, so both answer from here; each case runs through the three reads (one, the list, a project's).
 */
describe('OrganizationStrategicInitiativeService — who sees an initiative', () => {
	let service: OrganizationStrategicInitiativeService;
	let membership: { find: jest.Mock; findOne: jest.Mock };
	/** The caller's `user_organization` rows: an organization id, or a row with its own `isActive` / `isArchived`. */
	let memberOf: Array<string | { organizationId: string; isActive?: boolean | null; isArchived?: boolean | null }>;
	let permissions: PermissionsEnum[];
	let manager: { find: jest.Mock };
	let project: { findOne: jest.Mock };

	const initiative = (
		visibilityScope: OrganizationStrategicVisibilityScopeEnum,
		stewardId: string | null = STEWARD,
		organizationId: string = ORGANIZATION
	) =>
		({
			id: 'initiative-1',
			tenantId: TENANT,
			organizationId,
			title: 'Agents ship',
			visibilityScope,
			stewardId,
			teams: [{ id: TEAM }],
			projects: []
		}) as any;

	/** Signs in: `employeeId` is the user's own employee; an admin's `currentEmployeeId()` is empty. */
	const signIn = (
		employeeId: string | null,
		granted: PermissionsEnum[] = [],
		organizations: typeof memberOf = [ORGANIZATION]
	) => {
		permissions = granted;
		memberOf = organizations;
		const admin = granted.includes(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(admin ? null : employeeId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, employeeId } as any);
	};
	/** What the three reads answer for one initiative: the row, or `null` for a miss (404 / filtered out). */
	const reads = async (row: any, projectOrganizationId: string = row.organizationId) => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByOptions').mockResolvedValue(row as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [row], total: 1 } as never);
		project.findOne.mockResolvedValue({
			id: 'project-1',
			organizationId: projectOrganizationId,
			organizationStrategicInitiatives: [row]
		});
		const miss = (error: unknown) => {
			if (error instanceof NotFoundException) return null;
			throw error;
		};
		const one = await service.findOneById('initiative-1').catch(miss);
		const list = (await service.findAll({} as any)).items;
		const ofProject = (await service.findByProject('project-1' as any).catch(miss)) ?? [];
		return { one: one ? one.id : null, list: list.length, ofProject: ofProject.length };
	};
	const seen = { one: 'initiative-1', list: 1, ofProject: 1 };
	const hidden = { one: null, list: 0, ofProject: 0 };

	beforeEach(() => {
		membership = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
		manager = {
			find: jest.fn(async (entity: unknown, { where }: any) =>
				entity === UserOrganization && where.userId === USER && where.tenantId === TENANT
					? memberOf.map((row) => (typeof row === 'string' ? { organizationId: row } : row))
					: []
			)
		};
		project = { findOne: jest.fn() };
		service = Object.create(OrganizationStrategicInitiativeService.prototype);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });
		Object.assign(service, {
			_roleService: { findOneByIdString: jest.fn().mockResolvedValue({ name: 'EMPLOYEE' }) },
			_typeOrmOrganizationTeamEmployeeRepository: membership,
			_typeOrmOrganizationProjectRepository: project
		});
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			permissions.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the steward always sees it', () => {
		it('also as an admin who is not on the team (the local e2e 404)', async () => {
			signIn(STEWARD, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM))).toEqual(seen);
		});

		it('a leadership-scoped one too', async () => {
			signIn(STEWARD, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.LEADERSHIP))).toEqual(seen);
		});
	});

	it('an admin on a linked team sees a team-scoped one through their own employee', async () => {
		signIn(OTHER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
		membership.find.mockResolvedValue([{ organizationTeamId: TEAM }]);
		membership.findOne.mockResolvedValue({ employeeId: OTHER, organizationTeamId: TEAM });
		expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, null))).toEqual(seen);
		expect(membership.find.mock.calls[0][0].where.employeeId).toBe(OTHER);
	});

	describe('an organization admin who may edit initiatives', () => {
		const initiativeAdmin = [
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
		];

		it('sees every initiative of their organization, steward or not, team or not', async () => {
			signIn(null, initiativeAdmin);
			for (const scope of [
				OrganizationStrategicVisibilityScopeEnum.TEAM,
				OrganizationStrategicVisibilityScopeEnum.LEADERSHIP
			]) {
				expect(await reads(initiative(scope, OTHER))).toEqual(seen);
			}
		});

		it('also when the caller selected columns without the organization (#11050 review)', async () => {
			signIn(null, initiativeAdmin);
			const row = initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, OTHER);
			const findOne = jest
				.spyOn(TenantAwareCrudService.prototype, 'findOneByOptions')
				.mockResolvedValue(row as never);
			const findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [row], total: 1 } as never);
			await expect(
				service.findOneById('initiative-1', { select: { id: true, title: true } } as any)
			).resolves.toMatchObject({
				id: 'initiative-1'
			});
			expect((await service.findAll({ select: ['id', 'title'] } as any)).items).toHaveLength(1);
			// The rule's columns are read next to the caller's: the object form stays an object, the list a list.
			expect((findOne.mock.calls[0][0] as any).select).toEqual({
				id: true,
				title: true,
				organizationId: true,
				visibilityScope: true,
				stewardId: true
			});
			expect((findAll.mock.calls[0][0] as any).select).toEqual([
				'id',
				'title',
				'organizationId',
				'visibilityScope',
				'stewardId'
			]);
			// No selection reads every column, as before.
			await service.findAll({} as any);
			expect(findAll.mock.calls[1][0]).not.toHaveProperty('select');
		});

		it('never one of another organization of the tenant they are not a member of (#11050 review)', async () => {
			signIn(null, initiativeAdmin, [ORGANIZATION]);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, OTHER, OTHER_ORGANIZATION))
			).toEqual(hidden);
		});

		it('nor any without a user in the request (fails closed)', async () => {
			signIn(null, initiativeAdmin);
			jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, OTHER))).toEqual(hidden);
		});
	});

	describe('everybody else keeps the rule', () => {
		it('an employee who is not the steward nor on the team', async () => {
			signIn(OTHER, [
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
			]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM))).toEqual(hidden);
		});

		it('an admin who may not edit initiatives, not the steward nor on the team', async () => {
			signIn(OTHER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM))).toEqual(hidden);
		});

		it('a user with no employee never matches an initiative with no steward', async () => {
			signIn(null, [PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, null))).toEqual(hidden);
		});
	});

	/**
	 * The reads are bound to the caller's organizations (#11050 review, CWE-863): the CRUD base adds the tenant,
	 * not the organization, and neither the routes nor the GraphQL fields check membership of the record's
	 * organization, so an organization- or leadership-scoped initiative of another organization of the tenant
	 * was readable by id, by project or in the list. Every read now answers only initiatives of an organization
	 * the caller is a current member of (a `user_organization` row of the tenant that is not deactivated or
	 * archived); inside them the scope rule, the steward and the initiative admins' rule are unchanged.
	 */
	describe('only initiatives of the organizations the caller belongs to', () => {
		const reader = [PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ];
		const asLeadership = () => {
			jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-manager');
			Object.assign(service, {
				_roleService: { findOneByIdString: jest.fn().mockResolvedValue({ name: 'MANAGER' }) }
			});
		};

		it('an organization-scoped one: seen in their organization, never in another one of the tenant', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION))).toEqual(seen);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION, STEWARD, OTHER_ORGANIZATION))
			).toEqual(hidden);
		});

		it('a leadership-scoped one: leadership of their organization only', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			asLeadership();
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.LEADERSHIP))).toEqual(seen);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.LEADERSHIP, STEWARD, OTHER_ORGANIZATION))
			).toEqual(hidden);
		});

		it('a member of both organizations sees both', async () => {
			signIn(OTHER, reader, [ORGANIZATION, OTHER_ORGANIZATION]);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION, STEWARD, OTHER_ORGANIZATION))
			).toEqual(seen);
		});

		it('the steward of one in an organization they are no longer a member of does not', async () => {
			signIn(STEWARD, reader, [ORGANIZATION]);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, STEWARD, OTHER_ORGANIZATION))
			).toEqual(hidden);
		});

		it('a deactivated or archived membership does not count (nor for the initiative admins)', async () => {
			for (const row of [
				{ organizationId: ORGANIZATION, isActive: false },
				{ organizationId: ORGANIZATION, isArchived: true }
			]) {
				signIn(OTHER, reader, [row]);
				expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION))).toEqual(hidden);
				signIn(null, [...reader, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE], [row]);
				expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, OTHER))).toEqual(hidden);
			}
			// A row that states neither (as the column defaults leave it) is a current membership.
			signIn(OTHER, reader, [{ organizationId: ORGANIZATION, isActive: null, isArchived: null }]);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION))).toEqual(seen);
		});

		it('nothing without a user in the request (fails closed)', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);
			expect(await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION))).toEqual(hidden);
		});

		it("a project of another organization answers 404, as one that is not there", async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			project.findOne.mockResolvedValue({
				id: 'project-1',
				organizationId: OTHER_ORGANIZATION,
				organizationStrategicInitiatives: []
			});
			await expect(service.findByProject('project-1' as any)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('an initiative read with no organization is never answered', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			expect(
				await reads(initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION, STEWARD, null), ORGANIZATION)
			).toEqual(hidden);
		});

		/** The organizations a read's `where.organizationId` (an `In(...)`) names. */
		const organizationsOf = (where: any): string[] => where?.organizationId?._value ?? where?.organizationId?.value;

		it('the list is bound in the query, before the page is cut (#11052 review)', async () => {
			signIn(OTHER, reader, [ORGANIZATION, OTHER_ORGANIZATION]);
			const findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [], total: 0 } as never);
			await service.findAll({ take: 10, skip: 0, where: { title: 'Agents ship' } } as any);
			const [options] = findAll.mock.calls[0] as any[];
			expect(options).toMatchObject({ take: 10, skip: 0, where: { title: 'Agents ship' } });
			expect(organizationsOf(options.where)).toEqual([ORGANIZATION, OTHER_ORGANIZATION]);
			// A stated organization of theirs is kept as it is; another one reads nothing.
			await service.findAll({ where: { organizationId: OTHER_ORGANIZATION } } as any);
			expect((findAll.mock.calls[1][0] as any).where).toEqual({ organizationId: OTHER_ORGANIZATION });
			signIn(OTHER, reader, [ORGANIZATION]);
			expect(await service.findAll({ where: { organizationId: OTHER_ORGANIZATION } } as any)).toEqual({ items: [], total: 0 });
			expect(findAll).toHaveBeenCalledTimes(2);
			// No organization at all: nothing is read.
			signIn(OTHER, reader, []);
			expect(await service.findAll({} as any)).toEqual({ items: [], total: 0 });
			expect(findAll).toHaveBeenCalledTimes(2);
		});

		it('the inherited page read (`GET /pagination`) answers what the list answers (#11052 review)', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			const rows = [
				initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION),
				initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION, STEWARD, OTHER_ORGANIZATION),
				initiative(OrganizationStrategicVisibilityScopeEnum.TEAM)
			];
			const findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: rows, total: rows.length } as never);
			const paginate = jest.spyOn(TenantAwareCrudService.prototype, 'paginate');
			const page = await service.paginate({ take: 5, order: { title: 'ASC' } } as any);
			expect(page).toEqual({ items: [rows[0]], total: 1 });
			expect(paginate).not.toHaveBeenCalled();
			const [options] = findAll.mock.calls[0] as any[];
			expect(options).toMatchObject({ order: { title: 'ASC' } });
			expect(options).not.toHaveProperty('take');
			expect(organizationsOf(options.where)).toEqual([ORGANIZATION]);
			expect(options.relations).toEqual(['teams', 'projects', 'projects.teams']);
		});

		it('later pages: the page is cut from the visible initiatives, and the total counts all of them (#11052 review)', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			const rows = Array.from({ length: 30 }, (_, i) => ({
				...initiative(
					i % 6 === 5 ? OrganizationStrategicVisibilityScopeEnum.TEAM : OrganizationStrategicVisibilityScopeEnum.ORGANIZATION
				),
				id: `initiative-${i}`
			}));
			jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: rows, total: rows.length } as never);
			const visible = rows.filter((_, i) => i % 6 !== 5).map((row) => row.id);
			expect(visible).toHaveLength(25);
			// `skip` is the page number, as in the CRUD base's paginate (10 per page unless `take` says otherwise).
			const second = await service.paginate({ take: 10, skip: 2 } as any);
			expect(second.total).toBe(25);
			expect(second.items.map((row) => row.id)).toEqual(visible.slice(10, 20));
			const first = await service.paginate({} as any);
			expect(first.items.map((row) => row.id)).toEqual(visible.slice(0, 10));
			// With no order of the caller's, by primary key, as the CRUD base's page (pages never overlap).
			const reads = (TenantAwareCrudService.prototype.findAll as unknown as jest.Mock).mock.calls;
			expect((reads[1][0] as any).order).toEqual({ id: 'ASC' });
			expect((await service.paginate({ take: 10, skip: 3 } as any)).items.map((row) => row.id)).toEqual(visible.slice(20, 25));
		});

		it('the count (`GET /count`, GraphQL) counts what the caller may see (#11052 review)', async () => {
			signIn(OTHER, reader, [ORGANIZATION]);
			const findAll = jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({
				items: [
					initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION),
					initiative(OrganizationStrategicVisibilityScopeEnum.ORGANIZATION, STEWARD, OTHER_ORGANIZATION),
					initiative(OrganizationStrategicVisibilityScopeEnum.LEADERSHIP)
				],
				total: 3
			} as never);
			const count = jest.spyOn(TenantAwareCrudService.prototype, 'countBy');
			expect(await service.countBy()).toBe(1);
			expect(await service.countBy({ title: 'Agents ship' } as any)).toBe(1);
			expect((findAll.mock.calls[1][0] as any).where).toMatchObject({ title: 'Agents ship' });
			expect(count).not.toHaveBeenCalled();
		});
	});
});
