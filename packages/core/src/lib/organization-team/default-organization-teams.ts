import { environment } from '@gauzy/config';

export const DEFAULT_ORGANIZATION_TEAMS = [
	{
		name: 'Employees',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ruslan@example-ever.co',
			'alish@example-ever.co',
			'julia@example-ever.co',
			'booster@example-ever.co',
			'yoster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.superAdminEmail}`, 'ruslan@example-ever.co']
	},
	{
		name: 'Contractors',
		defaultMembers: [
			`${environment.demoCredentialConfig.adminEmail}`,
			'ckhandla94@gmail.com',
			'hoster@example-ever.co',
			'aster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.adminEmail}`, 'ruslan@example-ever.co']
	},
	{
		name: 'Designers',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'julia@example-ever.co',
			'roster@example-ever.co',
			'dister@example-ever.co',
			'postern@example-ever.co'
		],
		manager: ['julia@example-ever.co', 'alish@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'QA',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'julia@example-ever.co',
			'kyoster@example-ever.co',
			'taster@example-ever.co',
			'mustero@smooper.xyz'
		],
		manager: ['julia@example-ever.co']
	},
	{
		name: 'Developers',
		defaultMembers: [
			`${environment.demoCredentialConfig.adminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ruslan@example-ever.co',
			'alish@example-ever.co',
			'booster@example-ever.co',
			'yoster@example-ever.co',
			'ckhandla94@gmail.com',
			'rahulrathore576@gmail.com'
		],
		manager: [`${environment.demoCredentialConfig.adminEmail}`, 'ruslan@example-ever.co', 'alish@example-ever.co']
	},
	{
		name: 'Marketing',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'julia@example-ever.co',
			'yostorono@example-ever.co',
			'desterrro@hotmail.com'
		],
		manager: ['yostorono@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'Default Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.employeeEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			'ruslan@example-ever.co',
			'alish@example-ever.co',
			'julia@example-ever.co'
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
			'ruslan@example-ever.co',
			'alish@example-ever.co',
			'ckhandla94@gmail.com',
			'rahulrathore576@gmail.com',
			'booster@example-ever.co',
			'hoster@example-ever.co'
		],
		manager: ['ruslan@example-ever.co', `${environment.demoCredentialConfig.adminEmail}`]
	},
	{
		name: 'Frontend Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'alish@example-ever.co',
			'julia@example-ever.co',
			'yoster@example-ever.co',
			'roster@example-ever.co',
			'dister@example-ever.co'
		],
		manager: ['alish@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'Mobile Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.employeeEmail}`,
			'ruslan@example-ever.co',
			'booster@example-ever.co',
			'ckhandla94@gmail.com',
			'yoster@example-ever.co',
			'postern@example-ever.co'
		],
		manager: ['ruslan@example-ever.co', `${environment.demoCredentialConfig.employeeEmail}`]
	},
	{
		name: 'DevOps Team',
		defaultMembers: [
			`${environment.demoCredentialConfig.superAdminEmail}`,
			`${environment.demoCredentialConfig.adminEmail}`,
			'ruslan@example-ever.co',
			'ckhandla94@gmail.com',
			'hoster@example-ever.co'
		],
		manager: [`${environment.demoCredentialConfig.superAdminEmail}`, 'ruslan@example-ever.co']
	}
];
