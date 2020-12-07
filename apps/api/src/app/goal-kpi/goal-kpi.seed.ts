import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee, IOrganization } from '@gauzy/models';
import { GoalKPI } from './goal-kpi.entity';
import * as faker from 'faker';
import { DEFAULT_GOAL_KPIS } from './default-goal-kpis';

export const createDefaultGoalKpi = async (
	connection: Connection,
	tenant: Tenant,
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
	return await insertRandomGoalKpi(connection, goalKpis);
};

const insertRandomGoalKpi = async (
	connection: Connection,
	goalKpis: GoalKPI[]
): Promise<GoalKPI[]> => {
	return await connection.manager.save(goalKpis);
};
