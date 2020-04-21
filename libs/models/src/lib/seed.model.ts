import { CurrenciesEnum, DefaultValueDateTypeEnum, User } from '..';

export interface IDefaultUser {
	email: string;
	password: string;
	imageUrl: string;
	firstName?: string;
	lastName?: string;
	startedWorkOn?: string;
	endWork?: string;
	employeeLevel?: string;
	candidateLevel?: string;
}

export interface IDefaultOrganization {
	name: string;
	currency: CurrenciesEnum;
	defaultValueDateType: DefaultValueDateTypeEnum;
	imageUrl: string;
}

export interface ISeedUsers {
	adminUsers: User[];
	employeeUsers: User[];
	candidateUsers: User[];
}
