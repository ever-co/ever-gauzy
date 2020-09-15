import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee, IOrganization } from '@gauzy/models';
import { GoalKPI } from './goal-kpi.entity';
import * as faker from 'faker';

const goalKPIData = [
	{
		id: 'a77d9bd8-0baa-4548-b153-e9f2bae51760',
		name: 'Average response time',
		description: '',
		type: 'Numerical',
		unit: 'ms',
		operator: '<=',
		currentValue: 1000,
		targetValue: 500
	},
	{
		id: '85f89379-f181-4f72-b722-d924df63c7ea',
		name: '# of Priority bugs in production',
		description: '',
		type: 'Numerical',
		unit: 'bugs',
		operator: '<=',
		currentValue: 15,
		targetValue: 2
	}
];

export const createDefaultGoalKpi = async (
	connection: Connection,
	tenant: Tenant,
	organizations: IOrganization[],
	employees: IEmployee[]
): Promise<GoalKPI[]> => {
	const GoalKpis: GoalKPI[] = [];

	organizations.forEach((organization, index) => {
		goalKPIData.forEach((goalKPI) => {
			const goalkpi = new GoalKPI();
			if (index === 0) {
				goalkpi.id = goalKPI.id;
			}
			goalkpi.name = goalKPI.name;
			goalkpi.description = ' ';
			goalkpi.type = goalKPI.type;
			goalkpi.operator = goalKPI.operator;
			goalkpi.unit = goalKPI.unit;
			goalkpi.lead = faker.random.arrayElement(employees);
			goalkpi.currentValue = goalKPI.currentValue;
			goalkpi.targetValue = goalKPI.targetValue;
			goalkpi.organization = organization;
			goalkpi.tenant = tenant;
			GoalKpis.push(goalkpi);
		});
	});

	await insertRandomGoalKpi(connection, GoalKpis);
	return GoalKpis;
};

const insertRandomGoalKpi = async (
	connection: Connection,
	Employees: GoalKPI[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(GoalKPI)
		.values(Employees)
		.execute();
};
