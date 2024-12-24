import { IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { DEFAULT_GOAL_KPI_TEMPLATES } from './default-goal-kpi-templates';
import { GoalKPITemplate } from './goal-kpi-template.entity';

export const createDefaultGoalKpiTemplate = async (
	dataSource: DataSource,
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
	return await insertRandomGoalKpi(dataSource, goalKpiTemplates);
};

const insertRandomGoalKpi = async (
	dataSource: DataSource,
	goalKpiTemplates: GoalKPITemplate[]
): Promise<GoalKPITemplate[]> => {
	return await dataSource.manager.save(goalKpiTemplates);
};
