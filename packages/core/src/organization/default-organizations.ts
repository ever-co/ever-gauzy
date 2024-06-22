import { CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/contracts';

export const DEFAULT_EVER_ORGANIZATIONS = [
	{
		name: 'i4net',
		currency: CurrenciesEnum.ILS,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/logo_i4net.png',
		isDefault: true,
		totalEmployees: 17
	},
	{
		name: 'i4net',
		currency: CurrenciesEnum.ILS,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/logo_i4net.png',
		isDefault: false,
		totalEmployees: 0
	}
];

export const DEFAULT_ORGANIZATIONS = [
	{
		name: 'Default Company',
		currency: CurrenciesEnum.USD,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/logo_i4net.png',
		isDefault: true,
		totalEmployees: 1
	}
];
