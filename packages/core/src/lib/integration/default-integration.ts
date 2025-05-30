import { IntegrationEnum, IntegrationTypeEnum } from '@gauzy/contracts';
import { sluggable } from '@gauzy/utils';

/**
 *
 */
export const DEFAULT_SYSTEM_INTEGRATIONS = [
	{
		name: IntegrationEnum.HUBSTAFF,
		imgSrc: 'hubstaff.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS],
		order: 1,
		redirectUrl: sluggable(IntegrationEnum.HUBSTAFF),
		provider: IntegrationEnum.HUBSTAFF
	},
	{
		name: IntegrationEnum.UPWORK,
		imgSrc: 'upwork.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS],
		order: 2,
		redirectUrl: sluggable(IntegrationEnum.UPWORK),
		provider: IntegrationEnum.UPWORK
	},
	{
		name: 'Import/Export',
		imgSrc: 'import-export.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.CRM],
		order: 6,
		redirectUrl: sluggable(IntegrationEnum.IMPORT_EXPORT),
		provider: IntegrationEnum.IMPORT_EXPORT
	},
	{
		name: IntegrationEnum.MakeCom,
		imgSrc: 'make-com.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.AUTOMATION_TOOLS],
		order: 7,
		redirectUrl: sluggable(IntegrationEnum.MakeCom),
		provider: IntegrationEnum.MakeCom
	},
	{
		name: IntegrationEnum.ZAPIER,
		imgSrc: 'zapier.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.AUTOMATION_TOOLS],
		order: 8,
		redirectUrl: sluggable(IntegrationEnum.ZAPIER),
		provider: IntegrationEnum.ZAPIER
	}
];

/**
 *
 */
export const DEFAULT_AI_INTEGRATIONS = [
	{
		name: 'Gauzy AI',
		imgSrc: 'gauzy-ai.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS],
		order: 3,
		redirectUrl: sluggable(IntegrationEnum.GAUZY_AI),
		provider: IntegrationEnum.GAUZY_AI
	}
];

/**
 *
 */
export const PROJECT_MANAGE_DEFAULT_INTEGRATIONS = [
	{
		name: IntegrationEnum.GITHUB,
		imgSrc: 'github.svg',
		isComingSoon: false,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT],
		order: 4,
		redirectUrl: sluggable(IntegrationEnum.GITHUB),
		provider: IntegrationEnum.GITHUB
	},
	{
		name: IntegrationEnum.JIRA,
		imgSrc: 'jira.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT],
		order: 5,
		redirectUrl: sluggable(IntegrationEnum.JIRA),
		provider: IntegrationEnum.JIRA
	}
];

export const DEFAULT_INTEGRATIONS = [
	...DEFAULT_SYSTEM_INTEGRATIONS,
	...DEFAULT_AI_INTEGRATIONS,
	...PROJECT_MANAGE_DEFAULT_INTEGRATIONS
];
