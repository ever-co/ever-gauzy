import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { OrganizationStrategicVisibilityScopeEnum, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const TEAM = 'c0000000-0000-4000-8000-00000000000a';
const STEWARD = 'e0000000-0000-4000-8000-0000000000aa';
const OTHER = 'e0000000-0000-4000-8000-0000000000bb';

/**
 * Who sees an initiative (G-P2-4 visibility rule; local Gauzy ↔ Ever Works e2e, matrix row 12): a team-scoped
 * initiative an Ever Works Mission became answered 404 to its own steward, an admin who is not on the team.
 * `RequestContext.currentEmployeeId()` is empty for a user who may act for every employee
 * (`CHANGE_SELECTED_EMPLOYEE`), so the steward check never matched an admin — nor did their team membership.
 *
 * The rule now reads the caller's own employee, and an organization admin who may edit initiatives (may act for
 * every employee and holds `ORG_STRATEGIC_INITIATIVE_UPDATE`) sees every initiative. REST and GraphQL read
 * through the same query handlers, so both answer from here.
 */
describe('OrganizationStrategicInitiativeService — who sees an initiative', () => {
	let service: OrganizationStrategicInitiativeService;
	let membership: { find: jest.Mock; findOne: jest.Mock };
	let permissions: PermissionsEnum[];

	const initiative = (
		visibilityScope: OrganizationStrategicVisibilityScopeEnum,
		stewardId: string | null = STEWARD
	) =>
		({
			id: 'initiative-1',
			tenantId: TENANT,
			title: 'Agents ship',
			visibilityScope,
			stewardId,
			teams: [{ id: TEAM }],
			projects: []
		}) as any;

	/** Signs in: `employeeId` is the user's own employee; an admin's `currentEmployeeId()` is empty. */
	const signIn = (employeeId: string | null, granted: PermissionsEnum[] = []) => {
		permissions = granted;
		const admin = granted.includes(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(admin ? null : employeeId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', employeeId } as any);
	};
	const readOne = (row: any) => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByOptions').mockResolvedValue(row as never);
		return service.findOneById('initiative-1');
	};
	const readAll = async (row: any) => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [row], total: 1 } as never);
		return (await service.findAll({} as any)).items;
	};

	beforeEach(() => {
		membership = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };
		service = Object.create(OrganizationStrategicInitiativeService.prototype);
		Object.assign(service, {
			_roleService: { findOneByIdString: jest.fn().mockResolvedValue({ name: 'EMPLOYEE' }) },
			_typeOrmOrganizationTeamEmployeeRepository: membership
		});
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			permissions.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('the steward always sees it', () => {
		it('also as an admin who is not on the team (the local e2e 404)', async () => {
			signIn(STEWARD, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			const row = initiative(OrganizationStrategicVisibilityScopeEnum.TEAM);
			await expect(readOne(row)).resolves.toMatchObject({ id: 'initiative-1' });
			expect(await readAll(row)).toHaveLength(1);
		});

		it('a leadership-scoped one too', async () => {
			signIn(STEWARD, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			await expect(
				readOne(initiative(OrganizationStrategicVisibilityScopeEnum.LEADERSHIP))
			).resolves.toMatchObject({ id: 'initiative-1' });
		});
	});

	it('an admin on a linked team sees a team-scoped one through their own employee', async () => {
		signIn(OTHER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
		membership.find.mockResolvedValue([{ organizationTeamId: TEAM }]);
		membership.findOne.mockResolvedValue({ employeeId: OTHER, organizationTeamId: TEAM });
		const row = initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, null);
		await expect(readOne(row)).resolves.toMatchObject({ id: 'initiative-1' });
		expect(await readAll(row)).toHaveLength(1);
		expect(membership.find.mock.calls[0][0].where.employeeId).toBe(OTHER);
	});

	it('an organization admin who may edit initiatives sees every one, steward or not, team or not', async () => {
		signIn(null, [
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
			PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
		]);
		for (const scope of [
			OrganizationStrategicVisibilityScopeEnum.TEAM,
			OrganizationStrategicVisibilityScopeEnum.LEADERSHIP
		]) {
			const row = initiative(scope, OTHER);
			await expect(readOne(row)).resolves.toMatchObject({ id: 'initiative-1' });
			expect(await readAll(row)).toHaveLength(1);
		}
	});

	describe('everybody else keeps the rule', () => {
		it('an employee who is not the steward nor on the team', async () => {
			signIn(OTHER, [
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ,
				PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE
			]);
			const row = initiative(OrganizationStrategicVisibilityScopeEnum.TEAM);
			await expect(readOne(row)).rejects.toBeInstanceOf(NotFoundException);
			expect(await readAll(row)).toHaveLength(0);
		});

		it('an admin who may not edit initiatives, not the steward nor on the team', async () => {
			signIn(OTHER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			const row = initiative(OrganizationStrategicVisibilityScopeEnum.TEAM);
			await expect(readOne(row)).rejects.toBeInstanceOf(NotFoundException);
			expect(await readAll(row)).toHaveLength(0);
		});

		it('a user with no employee never matches an initiative with no steward', async () => {
			signIn(null, [PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ]);
			await expect(
				readOne(initiative(OrganizationStrategicVisibilityScopeEnum.TEAM, null))
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});
});
