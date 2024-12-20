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
	// Insert in batches to prevent deadlocks
	return await insertRandomGoalKpiInBatches(dataSource, goalKpis, 100);
};

const insertRandomGoalKpiInBatches = async (
	dataSource: DataSource,
	goalKpis: GoalKPI[],
	batchSize: number
): Promise<GoalKPI[]> => {
	const insertedGoalKpis: GoalKPI[] = [];

	// Insert records in batches to avoid deadlocks
	for (let i = 0; i < goalKpis.length; i += batchSize) {
		const batch = goalKpis.slice(i, i + batchSize);
		await dataSource.transaction(async (manager) => {
			await manager.save(batch);
		});
		insertedGoalKpis.push(...batch);
	}

	return insertedGoalKpis;
};
