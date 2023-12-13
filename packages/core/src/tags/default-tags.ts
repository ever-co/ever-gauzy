import { ITag, TagEnum } from "@gauzy/contracts";

export const DEFAULT_GLOBAL_TAGS: string[] = [
	'VIP',
	'Urgent',
	'Crazy',
	'Broken',
	'TODO',
	'In Process',
	'Verified',
	'Third Party API',
	'Killer',
	'Idiot',
	'Super',
	'WIP'
];

export const DEFAULT_ORGANIZATION_TAGS: string[] = [
	'Program',
	'Mobile',
	'Frontend',
	'Backend',
	'Database',
	'Authentication',
	'Security',
	'Dashboard',
	'API',
	'Design',
	'Testing',
	'Local',
	'QC',
	'Production',
	'Development',
	'Crap'
];

export const DEFAULT_TAGS: ITag[] = [
	{
		name: TagEnum.MOBILE,
		icon: 'task-labels/mobile.svg',
		color: '#4E4AE8',
		textColor: '#67a946',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.FRONTEND,
		icon: 'task-labels/frontend.svg',
		color: '#41AB6B',
		textColor: '#42576c',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.BACKEND,
		icon: 'task-labels/backend.svg',
		color: '#E84A5D',
		textColor: '#c5da3e',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.WEB,
		icon: 'task-labels/web.svg',
		color: '#4192AB',
		textColor: '#5c64cf',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.UI_UX,
		icon: 'task-labels/ui-ux.svg',
		color: '#9641AB',
		textColor: '#276ea9',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.FULL_STACK,
		icon: 'task-labels/fullstack.svg',
		color: '#AB9A41',
		textColor: '#404fac',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.TABLET,
		icon: 'task-labels/tablet.svg',
		color: '#5CAB41',
		textColor: '#f15894',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.BUG,
		icon: 'task-labels/bug.svg',
		color: '#E78F5E',
		textColor: '#9c00de',
		description: null,
		isSystem: true
	}
];
