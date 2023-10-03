import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			'ruslan@example_ever.co',
			'alish@example_ever.co',
			'julia@example_ever.co'
		],
		manager: ['ruslan@example_ever.co']
	},
	{
		name: 'Contractors',
		defaultMembers: [
			'ckhandla94@gmail.com'
		],
		manager: ['ruslan@example_ever.co']
	},
	{
		name: 'Designers',
		defaultMembers: ['julia@example_ever.co'],
		manager: []
	},
	{
		name: 'QA',
		defaultMembers: ['julia@example_ever.co'],
		manager: []
	}
];
