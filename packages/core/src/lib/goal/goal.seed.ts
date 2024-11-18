import { Goal } from './goal.entity';
import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';
import { GoalLevelEnum, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { DEFAULT_GOALS } from './default-goals';

export const createDefaultGoals = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	employees: IEmployee[]
): Promise<Goal[]> => {
	const defaultGoals = [];
	const goalTimeFrames: GoalTimeFrame[] = await dataSource.manager.find(
		GoalTimeFrame
	);
	const orgTeams: OrganizationTeam[] = await dataSource.manager.find(
		OrganizationTeam
	);

	for await (const organization of organizations) {
		DEFAULT_GOALS.forEach((goalData) => {
			const goal = new Goal();
			goal.name = goalData.name;
			goal.progress = 0;
			goal.level = goalData.level;

			if (goal.level === GoalLevelEnum.EMPLOYEE) {
				goal.ownerEmployee = faker.helpers.arrayElement(employees);
			} else if (goal.level === GoalLevelEnum.TEAM) {
				goal.ownerTeam = faker.helpers.arrayElement(orgTeams);
			}

			goal.lead = faker.helpers.arrayElement(employees);
			goal.description = faker.person.jobDescriptor();
			goal.deadline = faker.helpers.arrayElement(goalTimeFrames).name;
			goal.tenant = tenant;
			goal.organization = organization;
			defaultGoals.push(goal);
		});
	}

	await insertDefaultGoals(dataSource, defaultGoals);
	return defaultGoals;
};

export const updateDefaultGoalProgress = async (
	dataSource: DataSource
): Promise<Goal[]> => {
	const goals: Goal[] = await dataSource.manager.find(Goal, {
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
				await dataSource.manager.update(
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
	dataSource: DataSource,
	defaultGoals: Goal[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(Goal)
		.values(defaultGoals)
		.execute();
};

export const createRandomGoal = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<Goal[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random Goal will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Random Goal will not be created'
		);
		return;
	}

	const goalTimeFrames: GoalTimeFrame[] = await dataSource.manager.find(
		GoalTimeFrame
	);

	const goals: Goal[] = [];

	for await (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for await (const organization of tenantOrgs) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			const organizationTeams = await dataSource.manager.find(OrganizationTeam, {
				where: [
					{ organizationId: organization.id }
				]
			});

			const goal = new Goal();
			goal.name = faker.person.jobTitle();
			goal.progress = 0;
			goal.level = faker.helpers.arrayElement(Object.values(GoalLevelEnum));

			if (goal.level === GoalLevelEnum.EMPLOYEE) {
				goal.ownerEmployee = faker.helpers.arrayElement(tenantEmployees);
			} else if (goal.level === GoalLevelEnum.TEAM) {
				goal.ownerTeam = faker.helpers.arrayElement(organizationTeams);
			}

			goal.lead = faker.helpers.arrayElement(tenantEmployees);
			goal.description = faker.person.jobDescriptor();
			goal.deadline = faker.helpers.arrayElement(goalTimeFrames).name;
			goal.tenant = tenant;
			goal.organization = organization;
			goals.push(goal);
		}
	}

	await dataSource.manager.save(goals);
	return goals;
};
