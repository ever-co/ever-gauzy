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
		color: '#4e4ae8',
		textColor: '#67a946',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.FRONTEND,
		icon: 'task-labels/frontend.svg',
		color: '#41ab6b',
		textColor: '#42576c',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.BACKEND,
		icon: 'task-labels/backend.svg',
		color: '#e84a5d',
		textColor: '#c5da3e',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.WEB,
		icon: 'task-labels/web.svg',
		color: '#4192ab',
		textColor: '#5c64cf',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.UI_UX,
		icon: 'task-labels/ui-ux.svg',
		color: '#9641ab',
		textColor: '#276ea9',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.FULL_STACK,
		icon: 'task-labels/fullstack.svg',
		color: '#ab9a41',
		textColor: '#404fac',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.TABLET,
		icon: 'task-labels/tablet.svg',
		color: '#5cab41',
		textColor: '#f15894',
		description: null,
		isSystem: true
	},
	{
		name: TagEnum.BUG,
		icon: 'task-labels/bug.svg',
		color: '#e78f5e',
		textColor: '#9c00de',
		description: null,
		isSystem: true
	}
];
