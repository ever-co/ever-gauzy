import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			'ruslan@ever.co',
			'alish@ever.co',
			'julia@ever.co'
		],
		manager: ['ruslan@ever.co']
	},
	{
		name: 'Contractors',
		defaultMembers: [			
			'ckhandla94@gmail.com'
		],
		manager: ['ruslan@ever.co']
	},
	{
		name: 'Designers',
		defaultMembers: ['julia@ever.co'],
		manager: []
	},
	{
		name: 'QA',
		defaultMembers: ['julia@ever.co'],
		manager: []
	}
];
