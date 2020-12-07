import { LanguagesEnum } from '@gauzy/models';

export const DEFAULT_SUPER_ADMINS = [
	{
		email: 'admin@ever.co',
		password: 'admin',
		firstName: 'Admin',
		lastName: 'Super',
		imageUrl: 'assets/images/avatars/ruslan.jpg',
		preferredLanguage: LanguagesEnum.ENGLISH
	}
];

export const DEFAULT_ADMINS = [
	{
		email: 'local.admin@ever.co',
		password: 'admin',
		firstName: 'Admin',
		lastName: 'Local',
		imageUrl: 'assets/images/avatars/ruslan.jpg',
		preferredLanguage: LanguagesEnum.ENGLISH
	}
];
