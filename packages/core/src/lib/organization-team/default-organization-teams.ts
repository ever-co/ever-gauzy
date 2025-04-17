import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			'ruslan@example-dspot.com.pl',
			'alish@example-dspot.com.pl',
			'julia@example-dspot.com.pl'
		],
		manager: ['ruslan@example-dspot.com.pl']
	},
	{
		name: 'Contractors',
		defaultMembers: [
			'ckhandla94@gmail.com'
		],
		manager: ['ruslan@example-dspot.com.pl']
	},
	{
		name: 'Designers',
		defaultMembers: ['julia@example-dspot.com.pl'],
		manager: []
	},
	{
		name: 'QA',
		defaultMembers: ['julia@example-dspot.com.pl'],
		manager: []
	},
	{
		name: 'Default Team',
		defaultMembers: [environment.demoCredentialConfig.employeeEmail],
		manager: [environment.demoCredentialConfig.superAdminEmail]
	}
];
