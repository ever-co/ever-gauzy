import { LanguagesEnum } from '@gauzy/contracts';

export const DEFAULT_SUPER_ADMINS = [
	{
		email: 'admin@ever.co',
		password: 'admin',
		firstName: 'Super',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH
	}
];

// TODO: just remove this one and use DEFAULT_SUPER_ADMINS instead
export const BASIC_SUPER_ADMINS = [
	{
		email: 'admin@ever.co',
		password: 'admin',
		firstName: 'Super',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH
	}
];

export const DEFAULT_ADMINS = [
	{
		email: 'local.admin@ever.co',
		password: 'admin',
		firstName: 'Super',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH
	}
];
