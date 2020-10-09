import { Connection } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { GoalKPITemplate } from './goal-kpi-template.entity';

const goalKPIData = [
	{
		name: 'Average response time',
		description: '',
		type: 'Numerical',
		unit: 'ms',
		operator: '<=',
		currentValue: 1000,
		targetValue: 500
	},
	{
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
	tenant: Tenant,
	organization: Organization
): Promise<GoalKPITemplate[]> => {
	const GoalKpiTemplates: GoalKPITemplate[] = [];
	goalKPIData.forEach((goalKPI) => {
		const goalkpi = new GoalKPITemplate();
		goalkpi.name = goalKPI.name;
		goalkpi.description = ' ';
		goalkpi.type = goalKPI.type;
		goalkpi.operator = goalKPI.operator;
		goalkpi.unit = goalKPI.unit;
		goalkpi.currentValue = goalKPI.currentValue;
		goalkpi.targetValue = goalKPI.targetValue;
		goalkpi.organization = organization;
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
