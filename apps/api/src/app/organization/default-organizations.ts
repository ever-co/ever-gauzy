import { CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';

export const DEFAULT_ORGANIZATIONS = [
	{
		name: 'Ever Technologies LTD',
		currency: CurrenciesEnum.BGN,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/ever-large.jpg'
	},
	{
		name: 'Ever Co. Ltd',
		currency: CurrenciesEnum.BGN,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/ever-large.jpg'
	}
];
