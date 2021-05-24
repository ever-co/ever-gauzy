import { ComponentLayoutStyleEnum, LanguagesEnum } from '@gauzy/contracts';

export const DEFAULT_CANDIDATES = [
	{
		email: 'john@ever.co',
		password: '123456',
		firstName: 'John',
		lastName: 'Smith',
		imageUrl: 'assets/images/avatars/alish.jpg',
		candidateLevel: 'D',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'jaye@ever.co',
		password: '123456',
		firstName: 'Jaye',
		lastName: 'Jeffreys',
		imageUrl: 'assets/images/avatars/alexander.jpg',
		candidateLevel: 'B',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'kasey@ever.co',
		password: '123456',
		firstName: 'Kasey',
		lastName: 'Kraker',
		imageUrl: 'assets/images/avatars/rachit.png',
		candidateLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'norris@ever.co',
		password: '123456',
		firstName: 'Norris ',
		lastName: 'Nesbit',
		imageUrl: 'assets/images/avatars/blagovest.jpg',
		candidateLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'estella@ever.co',
		password: '123456',
		firstName: 'Estella',
		lastName: 'Ennis',
		imageUrl: 'assets/images/avatars/dimana.jpeg',
		candidateLevel: null,
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	},
	{
		email: 'greg@ever.co',
		password: '123456',
		firstName: 'Greg ',
		lastName: 'Grise',
		imageUrl: 'assets/images/avatars/hristo.jpg',
		candidateLevel: 'A',
		preferredLanguage: LanguagesEnum.ENGLISH,
		preferredComponentLayout: ComponentLayoutStyleEnum.TABLE
	}
];
