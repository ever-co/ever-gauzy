import { IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { DEFAULT_GOAL_KPI_TEMPLATES } from './default-goal-kpi-templates';
import { GoalKPITemplate } from './goal-kpi-template.entity';

export const createDefaultGoalKpiTemplate = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<GoalKPITemplate[]> => {
	const goalKpiTemplates: GoalKPITemplate[] = [];
	DEFAULT_GOAL_KPI_TEMPLATES.forEach((item) => {
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
