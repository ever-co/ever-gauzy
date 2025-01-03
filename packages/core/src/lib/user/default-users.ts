import { ComponentLayoutStyleEnum, LanguagesEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';

export const DEFAULT_SUPER_ADMINS = [
	{
		email: `${environment.demoCredentialConfig.superAdminEmail}`,
		password: `${environment.demoCredentialConfig.superAdminPassword}`,
		firstName: 'Super',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];

export const DEFAULT_ADMINS = [
	{
		email: `${environment.demoCredentialConfig.adminEmail}`,
		password: `${environment.demoCredentialConfig.adminPassword}`,
		firstName: 'Local',
		lastName: 'Admin',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];