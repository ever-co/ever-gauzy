import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { IOrganizationStrategicInitiativeRead, OrganizationStrategicVisibilityScopeEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { OrganizationTeam } from '../core/entities/internal';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
const TEAM_A = 'c0000000-0000-4000-8000-00000000000a';
const TEAM_B = 'c0000000-0000-4000-8000-00000000000b';
const OTHER_ORG_TEAM = 'c0000000-0000-4000-8000-00000000000f';
const EMPLOYEE = 'e0000000-0000-4000-8000-000000000001';

/**
 * Strategic initiatives can be linked to teams directly (G-P2-4): an Ever Works Mission scoped to a Team maps
 * to an initiative linked to that team. The writes take `teamIds` (each must be a team of the initiative's
 * organization), the reads answer `teamIds`, and `visibilityScope = 'team'` now means the teams linked
 * directly OR the teams of the aligned projects.
 */
describe('OrganizationStrategicInitiativeService — teams', () => {
	let service: OrganizationStrategicInitiativeService;
	let teamsInTenant: Array<{ id: string; organizationId: string; tenantId: string }>;
	let membership: { find: jest.Mock; findOne: jest.Mock };
	let save: jest.SpyInstance;

	beforeEach(() => {
		teamsInTenant = [
			{ id: TEAM_A, organizationId: ORGANIZATION, tenantId: TENANT },
			{ id: TEAM_B, organizationId: ORGANIZATION, tenantId: TENANT },
			{ id: OTHER_ORG_TEAM, organizationId: 'b0000000-0000-4000-8000-0000000000ff', tenantId: TENANT }
		];
		const find = jest.fn(async (entity: unknown, { where }: any) => {
			if (entity !== OrganizationTeam) return [];
			const ids: string[] = where.id?._value ?? where.id?.value ?? [];
			return teamsInTenant.filter(
				(team) =>
					ids.includes(team.id) &&
					team.organizationId === where.organizationId &&
					team.tenantId === where.tenantId
			);
		});
		membership = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null) };

		service = Object.create(OrganizationStrategicInitiativeService.prototype);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager: { find } }, configurable: true });
		Object.assign(service, {
			_employeeService: { findOneByIdString: jest.fn().mockResolvedValue({ id: EMPLOYEE }) },
			_activityLogService: { logActivity: jest.fn() },
			_roleService: { findOneByIdString: jest.fn().mockResolvedValue({ name: 'EMPLOYEE' }) },
			_typeOrmOrganizationTeamEmployeeRepository: membership
		});

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(null);
		save = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: any) => ({ id: 'initiative-1', title: 'T', ...entity }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('writes', () => {
		it('links the stated teams of the organization on create, and answers their ids', async () => {
			const created = await service.create({
				organizationId: ORGANIZATION,
				title: 'Agents ship',
				teamIds: [TEAM_A, TEAM_B, TEAM_A]
			} as any);

			const saved = save.mock.calls[0][0] as any;
			expect(saved.teams).toEqual([{ id: TEAM_A }, { id: TEAM_B }]);
			expect(saved).not.toHaveProperty('teamIds');
			expect((created as IOrganizationStrategicInitiativeRead).teamIds).toEqual([TEAM_A, TEAM_B]);
		});

		it('refuses a team of another organization', async () => {
			await expect(
				service.create({ organizationId: ORGANIZATION, title: 'T', teamIds: [TEAM_A, OTHER_ORG_TEAM] } as any)
			).rejects.toBeInstanceOf(BadRequestException);
			expect(save).not.toHaveBeenCalled();
		});

		it('leaves the teams alone on an update that does not state them, and replaces them when it does', async () => {
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByWhereOptions').mockResolvedValue({
				id: 'initiative-1',
				title: 'T',
				organizationId: ORGANIZATION,
				tenantId: TENANT
			} as never);

			await service.update('initiative-1', { title: 'Renamed' });
			expect(save.mock.calls[0][0]).not.toHaveProperty('teams');

			await service.update('initiative-1', { teamIds: [TEAM_B] });
			expect((save.mock.calls[1][0] as any).teams).toEqual([{ id: TEAM_B }]);

			await service.update('initiative-1', { teamIds: [] });
			expect((save.mock.calls[2][0] as any).teams).toEqual([]);
		});
	});

	describe("visibility 'team'", () => {
		const initiative = (teams: string[], projectTeams: string[] = []) =>
			({
				id: 'initiative-1',
				visibilityScope: OrganizationStrategicVisibilityScopeEnum.TEAM,
				stewardId: 'someone-else',
				teams: teams.map((id) => ({ id })),
				projects: projectTeams.length ? [{ id: 'p-1', teams: projectTeams.map((id) => ({ id })) }] : []
			}) as any;
		const canSee = (row: any, employeeTeams: string[]) =>
			service['canViewOrganizationStrategicInitiativeSync'](row, EMPLOYEE, new Set(employeeTeams), false);

		it('lets the members of a directly linked team see it', () => {
			expect(canSee(initiative([TEAM_A]), [TEAM_A])).toBe(true);
		});

		it('still lets the members of the teams of an aligned project see it', () => {
			expect(canSee(initiative([], [TEAM_B]), [TEAM_B])).toBe(true);
		});

		it('hides it from everybody else', () => {
			expect(canSee(initiative([TEAM_A], [TEAM_B]), ['c0000000-0000-4000-8000-0000000000cc'])).toBe(false);
			expect(canSee(initiative([TEAM_A]), [])).toBe(false);
		});

		it('the single-row read checks the directly linked teams too', async () => {
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByOptions').mockResolvedValue(
				initiative([TEAM_A]) as never
			);
			membership.findOne.mockResolvedValue({ employeeId: EMPLOYEE, organizationTeamId: TEAM_A });

			const row = await service.findOneById('initiative-1');

			expect((row as IOrganizationStrategicInitiativeRead).teamIds).toEqual([TEAM_A]);
			const [{ where }] = membership.findOne.mock.calls[0];
			expect(where.organizationTeamId._value ?? where.organizationTeamId.value).toEqual([TEAM_A]);
		});
	});
});
