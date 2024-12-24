import { ComponentLayoutStyleEnum, LanguagesEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';

export const DEFAULT_EMPLOYEES: any = [
	{
		email: `${environment.demoCredentialConfig.employeeEmail}`,
		password: `${environment.demoCredentialConfig.employeePassword}`,
		firstName: 'Default',
		lastName: 'Employee',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2018-03-20',
		employeeLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];

export const DEFAULT_EVER_EMPLOYEES: any = [
	{
		email: 'ruslan@example-ever.co',
		password: '123456',
		firstName: 'Ruslan',
		lastName: 'K.',
		imageUrl: 'assets/images/avatars/ruslan.jpg',
		employeeLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'alish@example-ever.co',
		password: '123456',
		firstName: 'Alish',
		lastName: 'M.',
		imageUrl: 'assets/images/avatars/alish.jpg',
		startedWorkOn: '2018-03-20',
		endWork: null,
		employeeLevel: 'D',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'booster@example-ever.co',
		password: '123456',
		firstName: 'Booster',
		lastName: 'P.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2018-03-19',
		endWork: null,
		employeeLevel: 'C',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'yoster@example-ever.co',
		password: '123456',
		firstName: 'Yoster',
		lastName: 'F.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2018-05-25',
		endWork: null,
		employeeLevel: 'C',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'hoster@example-ever.co',
		password: '123456',
		firstName: 'Hoster',
		lastName: 'H.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2019-06-17',
		endWork: null,
		employeeLevel: 'B',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'aster@example-ever.co',
		password: '123456',
		firstName: 'Aster',
		lastName: 'A.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2019-08-01',
		endWork: null,
		employeeLevel: 'B',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'roster@example-ever.co',
		password: '123456',
		firstName: 'Roster',
		lastName: 'R.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2019-11-27',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'dister@example-ever.co',
		password: '123456',
		firstName: 'Dister',
		lastName: 'D.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2019-11-26',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'postern@example-ever.co',
		password: '123456',
		firstName: 'Postern',
		lastName: 'P.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2020-03-16',
		endWork: null,
		employeeLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'kyoster@example-ever.co',
		password: '123456',
		firstName: 'Kyoster',
		lastName: 'K.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2020-02-05',
		endWork: null,
		employeeLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'taster@example-ever.co',
		password: '123456',
		firstName: 'Taster',
		lastName: 'T.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2020-03-02',
		endWork: null,
		employeeLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'mustero@smooper.xyz',
		password: '123456',
		firstName: 'Mustero',
		lastName: 'M.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2019-11-27',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'desterrro@hotmail.com',
		password: '123456',
		firstName: 'Desterrro',
		lastName: 'D.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2020-03-07',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'ckhandla94@gmail.com',
		password: '123456',
		firstName: 'Chetan',
		lastName: 'K.',
		imageUrl: 'assets/images/avatars/chetan.png',
		startedWorkOn: '2020-03-07',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'rahulrathore576@gmail.com',
		password: '123456',
		firstName: 'Rahul',
		lastName: 'R.',
		imageUrl: 'assets/images/avatars/rahul.png',
		startedWorkOn: '2020-09-10',
		endWork: null,
		employeeLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'julia@example-ever.co',
		password: '123456',
		firstName: 'Julia',
		lastName: 'K.',
		imageUrl: 'assets/images/avatars/julia.png',
		startedWorkOn: '2018-08-01',
		endWork: null,
		employeeLevel: 'C',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'yostorono@example-ever.co',
		password: '123456',
		firstName: 'Yostorono',
		lastName: 'Y.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		startedWorkOn: '2018-08-01',
		endWork: null,
		employeeLevel: 'C',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];
