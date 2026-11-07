import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ronan@example-ever.co',
			'aiden@example-ever.co',
			'jasmine@example-ever.co',
			'booster@example-ever.co',
			'yoster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.superAdminEmail}`, 'ronan@example-ever.co']
	},
	{
		name: 'Contractors',
		defaultMembers: [
			`${environment.demoCredentialConfig.adminEmail}`,
			'carter@example-ever.co',
			'hoster@example-ever.co',
			'aster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.adminEmail}`, 'ronan@example-ever.co']
	},
	{
		name: 'Designers',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'jasmine@example-ever.co',
			'roster@example-ever.co',
			'dister@example-ever.co',
			'postern@example-ever.co'
		],
		manager: ['jasmine@example-ever.co', 'aiden@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'QA',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'jasmine@example-ever.co',
			'kyoster@example-ever.co',
			'taster@example-ever.co',
			'mustero@example-ever.co'
		],
		manager: ['jasmine@example-ever.co']
	},
	{
		name: 'Developers',
		defaultMembers: [
			`${environment.demoCredentialConfig.adminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ronan@example-ever.co',
			'aiden@example-ever.co',
			'booster@example-ever.co',
			'yoster@example-ever.co',
			'carter@example-ever.co',
			'rafael@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.adminEmail}`, 'ronan@example-ever.co', 'aiden@example-ever.co']
	},
	{
		name: 'Marketing',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'jasmine@example-ever.co',
			'yostorono@example-ever.co',
			'desterrro@example-ever.co'
		],
		manager: ['yostorono@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'Default Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			'ronan@example-ever.co',
			'aiden@example-ever.co',
			'jasmine@example-ever.co'
		],
		manager: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`
		]
	},
	{
		name: 'Backend Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.adminEmail}`,
			'ronan@example-ever.co',
			'aiden@example-ever.co',
			'carter@example-ever.co',
			'rafael@example-ever.co',
			'booster@example-ever.co',
			'hoster@example-ever.co'
		],
		manager: ['ronan@example-ever.co', `${environment.demoCredentialConfig.adminEmail}`]
	},
	{
		name: 'Frontend Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'aiden@example-ever.co',
			'jasmine@example-ever.co',
			'yoster@example-ever.co',
			'roster@example-ever.co',
			'dister@example-ever.co'
		],
		manager: ['aiden@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'Mobile Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ronan@example-ever.co',
			'booster@example-ever.co',
			'carter@example-ever.co',
			'yoster@example-ever.co',
			'postern@example-ever.co'
		],
		manager: ['ronan@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'DevOps Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			'ronan@example-ever.co',
			'carter@example-ever.co',
			'hoster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.superAdminEmail}`, 'ronan@example-ever.co']
	}
];
