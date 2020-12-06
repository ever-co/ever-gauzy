import { Connection } from 'typeorm';
import { GoalTemplate } from './goal-template.entity';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { DEFAULT_GOAL_TEMPLATES } from './default-goal-templates';

export const createDefaultGoalTemplates = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization
): Promise<GoalTemplate[]> => {
	const defaultGoalTemplates = [];
	DEFAULT_GOAL_TEMPLATES.forEach((goalData) => {
		const goalTemplate = new GoalTemplate();
		goalTemplate.name = goalData.name;
		goalTemplate.level = goalData.level;
		goalTemplate.category = goalData.category;
		goalTemplate.tenant = tenant;
		goalTemplate.organization = organization;
		defaultGoalTemplates.push(goalTemplate);
	});

	return await insertDefaultGoalTemplates(connection, defaultGoalTemplates);
};

const insertDefaultGoalTemplates = async (
	connection: Connection,
	defaultGoalTemplates: GoalTemplate[]
): Promise<GoalTemplate[]> => {
	return await connection.manager.save(defaultGoalTemplates);
};
