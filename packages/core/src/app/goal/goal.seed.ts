import { Goal } from './goal.entity';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as faker from 'faker';
import { Employee } from '../employee/employee.entity';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';
import { GoalLevelEnum } from '@gauzy/contracts';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { DEFAULT_GOALS } from './default-goals';

export const createDefaultGoals = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[],
	employees: Employee[]
): Promise<Goal[]> => {
	const defaultGoals = [];
	const goalTimeFrames: GoalTimeFrame[] = await connection.manager.find(
		GoalTimeFrame
	);
	const orgTeams: OrganizationTeam[] = await connection.manager.find(
		OrganizationTeam
	);

	organizations.forEach((organization, index) => {
		DEFAULT_GOALS.forEach((goalData) => {
			const goal = new Goal();
			goal.name = goalData.name;
			goal.progress = 0;
			goal.level = goalData.level;
			if (goal.level === GoalLevelEnum.EMPLOYEE) {
				goal.ownerEmployee = faker.random.arrayElement(employees);
			} else if (goal.level === GoalLevelEnum.TEAM) {
				goal.ownerTeam = faker.random.arrayElement(orgTeams);
			} else if (goal.level === GoalLevelEnum.ORGANIZATION) {
				goal.organization = organization;
			}
			goal.lead = faker.random.arrayElement(employees);
			goal.tenant = tenant;
			goal.description = ' ';
			goal.deadline = faker.random.arrayElement(goalTimeFrames).name;
			goal.organization = organization;
			goal.organizationId = organization.id;
			defaultGoals.push(goal);
		});
	});

	await insertDefaultGoals(connection, defaultGoals);

	return defaultGoals;
};

export const updateDefaultGoalProgress = async (
	connection: Connection
): Promise<Goal[]> => {
	const goals: Goal[] = await connection.manager.find(Goal, {
		relations: ['keyResults']
	});
	if (goals && goals.length > 0) {
		goals.forEach(async (goal) => {
			if (goal.keyResults && goal.keyResults.length > 0) {
				const progressTotal = goal.keyResults.reduce(
					(a, b) => a + b.progress * +b.weight,
					0
				);
				const weightTotal = goal.keyResults.reduce(
					(a, b) => a + +b.weight,
					0
				);
				const goalProgress = Math.round(progressTotal / weightTotal);
				await connection.manager.update(
					Goal,
					{ id: goal.id },
					{
						progress: goalProgress
					}
				);
			}
		});
		return goals;
	}
};

const insertDefaultGoals = async (
	connection: Connection,
	defaultGoals: Goal[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Goal)
		.values(defaultGoals)
		.execute();
};

export const createRandomGoal = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantEmployeeMap: Map<Tenant, Employee[]>
): Promise<Goal[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random Goal will not be created'
		);
		return;
	}
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Random Goal will not be created'
		);
		return;
	}

	const goalTimeFrames: GoalTimeFrame[] = await connection.manager.find(
		GoalTimeFrame
	);

	const goals: Goal[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const organizationTeams = await connection.manager.find(
				OrganizationTeam,
				{
					where: [{ organizationId: tenantOrg.id }]
				}
			);

			const goal = new Goal();

			goal.name = faker.name.jobTitle();
			goal.progress = 0;
			goal.level = faker.random.arrayElement([
				'Organization',
				'Team',
				'Employee'
			]);
			if (goal.level === GoalLevelEnum.EMPLOYEE) {
				goal.ownerEmployee = faker.random.arrayElement(tenantEmployees);
			} else if (goal.level === GoalLevelEnum.TEAM) {
				goal.ownerTeam = faker.random.arrayElement(organizationTeams);
			} else if (goal.level === GoalLevelEnum.ORGANIZATION) {
				goal.organization = tenantOrg;
			}
			goal.lead = faker.random.arrayElement(tenantEmployees);
			goal.tenant = tenant;
			goal.description = faker.name.jobDescriptor();
			goal.deadline = faker.random.arrayElement(goalTimeFrames).name;
			goal.organization = tenantOrg;
			goal.organizationId = tenantOrg.id;

			goals.push(goal);
		}
	}

	await connection.manager.save(goals);
	return goals;
};
