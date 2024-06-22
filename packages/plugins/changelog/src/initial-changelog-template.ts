import { IChangelog } from "@gauzy/contracts";

export const INITIAL_CHANGELOG_TEMPLATE: IChangelog[] = [
	{
		icon: 'cube-outline',
		title: 'See new features',
		date: new Date(),
		content: 'Now you can read latest features changelog directly in i4net',
		isFeature: false,
		learnMoreUrl: '',
		imageUrl: ''
	},
	{
		icon: 'globe-outline',
		title: 'Ready to give i4net a try?',
		date: new Date(),
		isFeature: false,
		content: 'Customer relationship management, enterprise resource planning, sales management, supply chain management and production management',
		learnMoreUrl: '',
		imageUrl: ''
	},
	{
		icon: 'flash-outline',
		title: 'Visit our website for more information.',
		date: new Date(),
		isFeature: false,
		content: 'You are welcome to check more information about the platform at our official website.',
		learnMoreUrl: 'https://i4net.co.il/',
		imageUrl: ''
	},
	{
		icon: 'cube-outline',
		title: 'New CRM',
		date: new Date(),
		isFeature: true,
		content: 'Now you can read latest features changelog directly in i4net',
		learnMoreUrl: '',
		imageUrl: 'assets/images/features/macbook-2.png'
	},
	{
		icon: 'globe-outline',
		title: 'Most popular in 20 countries',
		date: new Date(),
		isFeature: true,
		content: 'Europe, Americas and Asia get choise',
		learnMoreUrl: '',
		imageUrl: 'assets/images/features/macbook-1.png'
	},
	{
		icon: 'flash-outline',
		title: 'Visit our website',
		date: new Date(),
		isFeature: true,
		content: 'You are welcome to check more information about the platform at our official website.',
		learnMoreUrl: '',
		imageUrl: ''
	}
];
