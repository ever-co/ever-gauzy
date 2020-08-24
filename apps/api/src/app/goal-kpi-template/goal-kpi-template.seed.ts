import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { GoalKPITemplate } from './goal-kpi-template.entity';

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

export const createDefaultGoalKpiTemplate = async (
	connection: Connection,
	tenant: Tenant
): Promise<GoalKPITemplate[]> => {
	const GoalKpiTemplates: GoalKPITemplate[] = [];

	goalKPIData.forEach((goalKPI) => {
		const goalkpi = new GoalKPITemplate();
		goalkpi.id = goalKPI.id;
		goalkpi.name = goalKPI.name;
		goalkpi.description = ' ';
		goalkpi.type = goalKPI.type;
		goalkpi.operator = goalKPI.operator;
		goalkpi.unit = goalKPI.unit;
		goalkpi.currentValue = goalKPI.currentValue;
		goalkpi.targetValue = goalKPI.targetValue;
		goalkpi.tenant = tenant;
		GoalKpiTemplates.push(goalkpi);
	});

	await insertRandomGoalKpi(connection, GoalKpiTemplates);
	return GoalKpiTemplates;
};

const insertRandomGoalKpi = async (
	connection: Connection,
	Employees: GoalKPITemplate[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(GoalKPITemplate)
		.values(Employees)
		.execute();
};
