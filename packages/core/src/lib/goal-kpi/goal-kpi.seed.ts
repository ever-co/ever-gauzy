import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { GoalKPI } from './goal-kpi.entity';
import { faker } from '@faker-js/faker';
import { DEFAULT_GOAL_KPIS } from './default-goal-kpis';

export const createDefaultGoalKpi = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	employees: IEmployee[]
): Promise<GoalKPI[]> => {
	const goalKpis: GoalKPI[] = [];
	organizations.forEach((organization: IOrganization) => {
		DEFAULT_GOAL_KPIS.forEach((goalKPI) => {
			const goalKpi = new GoalKPI();
			goalKpi.name = goalKPI.name;
			goalKpi.description = ' ';
			goalKpi.type = goalKPI.type;
			goalKpi.operator = goalKPI.operator;
			goalKpi.unit = goalKPI.unit;
			goalKpi.lead = faker.helpers.arrayElement(employees);
			goalKpi.currentValue = goalKPI.currentValue;
			goalKpi.targetValue = goalKPI.targetValue;
			goalKpi.organization = organization;
			goalKpi.tenant = tenant;
			goalKpis.push(goalKpi);
		});
	});
	// Insert all GoalKPI in a single transaction to avoid deadlocks
	return await insertGoalKpisInSingleTransaction(dataSource, goalKpis);
};

const insertGoalKpisInSingleTransaction = async (dataSource: DataSource, goalKpis: GoalKPI[]): Promise<GoalKPI[]> => {
	// Insert all goalKpis in a single transaction to avoid deadlocks
	const insertedGoalKpis: GoalKPI[] = [];
	await dataSource.transaction(async (manager) => {
		// Insert all records at once
		insertedGoalKpis.push(...(await manager.save(GoalKPI, goalKpis)));
	});
	return insertedGoalKpis;
};
