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
	let memberOf: string[];
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
		organizations: string[] = [ORGANIZATION]
	) => {
		permissions = granted;
		memberOf = organizations;
		const admin = granted.includes(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(admin ? null : employeeId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, employeeId } as any);
	};
	/** What the three reads answer for one initiative: the row, or `null` for a miss (404 / filtered out). */
	const reads = async (row: any) => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByOptions').mockResolvedValue(row as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [row], total: 1 } as never);
		project.findOne.mockResolvedValue({ id: 'project-1', organizationStrategicInitiatives: [row] });
		const one = await service.findOneById('initiative-1').catch((error) => {
			if (error instanceof NotFoundException) return null;
			throw error;
		});
		const list = (await service.findAll({} as any)).items;
		const ofProject = await service.findByProject('project-1' as any);
		return { one: one ? one.id : null, list: list.length, ofProject: ofProject.length };
	};
	const seen = { one: 'initiative-1', list: 1, ofProject: 1 };
	const hidden = { one: null, list: 0, ofProject: 0 };

	beforeEach(() => {
		membership = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
		manager = {
			find: jest.fn(async (entity: unknown, { where }: any) =>
				entity === UserOrganization && where.userId === USER && where.tenantId === TENANT
					? memberOf.map((organizationId) => ({ organizationId }))
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
});
