import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			'ruslan@example-ever.co',
			'alish@example-ever.co',
			'julia@example-ever.co'
		],
		manager: ['ruslan@example-ever.co']
	},
	{
		name: 'Contractors',
		defaultMembers: [
			'ckhandla94@gmail.com'
		],
		manager: ['ruslan@example-ever.co']
	},
	{
		name: 'Designers',
		defaultMembers: ['julia@example-ever.co'],
		manager: []
	},
	{
		name: 'QA',
		defaultMembers: ['julia@example-ever.co'],
		manager: []
	},
	{
		name: 'Default Team',
		defaultMembers: [environment.demoCredentialConfig.employeeEmail],
		manager: [environment.demoCredentialConfig.superAdminEmail]
	}
];
