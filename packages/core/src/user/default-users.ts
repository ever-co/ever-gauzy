import { ComponentLayoutStyleEnum, LanguagesEnum } from '@gauzy/contracts';

export const DEFAULT_SUPER_ADMINS = [
	{
		email: 'admin@ever.co',
		password: 'admin',
		firstName: 'Super',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];

export const DEFAULT_ADMINS = [
	{
		email: 'local.admin@ever.co',
		password: 'admin',
		firstName: 'Local',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];