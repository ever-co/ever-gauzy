import { Goal } from './goal.entity';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as faker from 'faker';
import { Employee } from '../employee/employee.entity';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';
import { GoalLevelEnum } from '@gauzy/models';
import { OrganizationTeam } from '../organization-team/organization-team.entity';

const defaultGoalData = [
	{
		name: 'Improve product performance',
		level: 'Organization'
	},
	{
		name: 'Successfully launch version 2 of our main product',
		level: 'Organization'
	},
	{
		name: 'Redesign and launch our new landing page',
		level: 'Team'
	},
	{
		name: 'Increase quality of releases and make sure they are timely',
		level: 'Team'
	},
	{
		name: 'Identify problems with current user interface',
		level: 'Employee'
	}
];

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
		defaultGoalData.forEach((goalData) => {
			const goal = new Goal();
			goal.name = goalData.name;
			goal.progress = 0;
			goal.level = goalData.level;
			if (goal.level === GoalLevelEnum.EMPLOYEE) {
				goal.ownerEmployee = faker.random.arrayElement(employees);
			} else if (goal.level === GoalLevelEnum.TEAM) {
				goal.ownerTeam = faker.random.arrayElement(orgTeams);
			} else if (goal.level === GoalLevelEnum.ORGANIZATION) {
				goal.ownerOrg = organization;
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
