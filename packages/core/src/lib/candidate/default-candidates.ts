import { ComponentLayoutStyleEnum, LanguagesEnum } from '@gauzy/contracts';

export const DEFAULT_CANDIDATES = [
	{
		email: 'john@example-ever.co',
		password: '123456',
		firstName: 'John',
		lastName: 'S.',
		imageUrl: 'assets/images/avatars/alish.jpg',
		candidateLevel: 'D',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'jaye@example-ever.co',
		password: '123456',
		firstName: 'Jaye',
		lastName: 'J.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		candidateLevel: 'B',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'kasey@example-ever.co',
		password: '123456',
		firstName: 'Kasey',
		lastName: 'K.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		candidateLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'norris@example-ever.co',
		password: '123456',
		firstName: 'Norris ',
		lastName: 'N.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		candidateLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'estella@example-ever.co',
		password: '123456',
		firstName: 'Estella',
		lastName: 'E.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		candidateLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'greg@example-ever.co',
		password: '123456',
		firstName: 'Greg ',
		lastName: 'G.',
		imageUrl: 'assets/images/avatars/avatar-default.svg',
		candidateLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];
