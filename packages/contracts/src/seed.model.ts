import { CurrenciesEnum } from './currency.model';
import { DefaultValueDateTypeEnum } from './organization.model';
import { ICandidateSource } from './candidate-source.model';
import { ComponentLayoutStyleEnum, IUser, LanguagesEnum } from './user.model';

export interface IDefaultUser {
	email: string;
	password: string;
	imageUrl: string;
	firstName?: string;
	lastName?: string;
	preferredLanguage: LanguagesEnum;
	preferredComponentLayout: ComponentLayoutStyleEnum
}

export interface IDefaultEmployee extends IDefaultUser {
	startedWorkOn?: string;
	endWork?: string;
	employeeLevel?: string;
}

export interface IDefaultCandidate extends IDefaultUser {
	candidateLevel?: string;
	source?: ICandidateSource;
}

export interface IDefaultOrganization {
	name: string;
	currency: CurrenciesEnum;
	defaultValueDateType: DefaultValueDateTypeEnum;
	imageUrl: string;
}

export interface ISeedUsers {
	adminUsers: IUser[];
	employeeUsers: IUser[];
	candidateUsers: IUser[];
}

export interface IDefaultProductCategory {
	name: string;
	description: string;
	imageUrl: string;
}

export interface IDefaultProductType {
	name: string;
	description: string;
	icon: string;
}
