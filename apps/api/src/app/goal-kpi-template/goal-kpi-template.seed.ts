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
	const goalKpiTemplates: GoalKPITemplate[] = [];
	goalKPIData.forEach((item) => {
		const goalKpi = new GoalKPITemplate();
		goalKpi.name = item.name;
		goalKpi.description = '';
		goalKpi.type = item.type;
		goalKpi.operator = item.operator;
		goalKpi.unit = item.unit;
		goalKpi.currentValue = item.currentValue;
		goalKpi.targetValue = item.targetValue;
		goalKpi.organization = organization;
		goalKpi.tenant = tenant;
		goalKpiTemplates.push(goalKpi);
	});
	return await insertRandomGoalKpi(connection, goalKpiTemplates);
};

const insertRandomGoalKpi = async (
	connection: Connection,
	goalKpiTemplates: GoalKPITemplate[]
): Promise<GoalKPITemplate[]> => {
	return await connection.manager.save(goalKpiTemplates);
};
