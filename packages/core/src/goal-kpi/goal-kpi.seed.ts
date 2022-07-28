import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { GoalKPI } from './goal-kpi.entity';
import { faker } from '@ever-co/faker';
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
			goalKpi.lead = faker.random.arrayElement(employees);
			goalKpi.currentValue = goalKPI.currentValue;
			goalKpi.targetValue = goalKPI.targetValue;
			goalKpi.organization = organization;
			goalKpi.tenant = tenant;
			goalKpis.push(goalKpi);
		});
	});
	return await insertRandomGoalKpi(dataSource, goalKpis);
};

const insertRandomGoalKpi = async (
	dataSource: DataSource,
	goalKpis: GoalKPI[]
): Promise<GoalKPI[]> => {
	return await dataSource.manager.save(goalKpis);
};
