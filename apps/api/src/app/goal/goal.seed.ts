import { Goal } from './goal.entity';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as faker from 'faker';
import { Employee } from '../employee/employee.entity';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';

export const createGoals = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[],
	employees: Employee[]
): Promise<Goal[]> => {
	const defaultGoals = [];
	const nameType = ['Organization', 'Employee', 'Team'];
	const goalTimeFrames: GoalTimeFrame[] = await connection.manager.find(
		GoalTimeFrame
	);

	organizations.forEach((organization) => {
		for (let i = 0; i < faker.random.number({ min: 4, max: 7 }); i++) {
			const goal = new Goal();
			(goal.name = `${faker.random.arrayElement(nameType)}-${
				faker.random.arrayElement(goalTimeFrames).name
			}`),
				(goal.progress = 0),
				(goal.level = goal.name.split('-', 1)[0]);
			goal.owner = faker.random.arrayElement(employees);
			goal.lead = faker.random.arrayElement(employees);
			goal.tenant = tenant;
			goal.description = ' ';
			goal.deadline = goal.name.split('-', 1)[1];
			goal.organization = organization;
			defaultGoals.push(goal);
		}
	});

	await insertGoals(connection, defaultGoals);

	return defaultGoals;
};

const insertGoals = async (connection: Connection, defaultGoals: Goal[]) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Goal)
		.values(defaultGoals)
		.execute();
};
