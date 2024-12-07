import { GoalTemplateCategoriesEnum, IGoalTemplate } from '@gauzy/contracts';

export const DEFAULT_GOAL_TEMPLATES: IGoalTemplate[] = [
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
