import { Connection } from 'typeorm';
import { GoalTemplate } from './goal-template.entity';
import { GoalTemplateCategoriesEnum } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';

const defaultGoalTemplateData = [
	{
		name: 'Improve product performance',
		level: 'Organization',
		category: GoalTemplateCategoriesEnum.PRODUCT_MANAGEMENT
	},
	{
		name: 'Successfully launch version 2 of our main product',
		level: 'Organization',
		category: GoalTemplateCategoriesEnum.MARKETING
	},
	{
		name: 'Redesign and launch our new landing page',
		level: 'Team',
		category: GoalTemplateCategoriesEnum.PRODUCT_MANAGEMENT
	},
	{
		name: 'Increase quality of releases and make sure they are timely',
		level: 'Team',
		category: GoalTemplateCategoriesEnum.PRODUCT_MANAGEMENT
	},
	{
		name: 'Identify problems with current user interface',
		level: 'Employee',
		category: GoalTemplateCategoriesEnum.PRODUCT_MANAGEMENT
	}
];

export const createDefaultGoalTemplates = async (
	connection: Connection,
	tenant: Tenant,
	organization: Organization
): Promise<GoalTemplate[]> => {
	const defaultGoalTemplates = [];
	defaultGoalTemplateData.forEach((goalData) => {
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
