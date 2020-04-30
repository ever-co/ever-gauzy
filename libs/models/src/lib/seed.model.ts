import { ICandidateSource } from '@gauzy/models';
import { CurrenciesEnum, DefaultValueDateTypeEnum, User } from '..';

export interface IDefaultUser {
	email: string;
	password: string;
	imageUrl: string;
	firstName?: string;
	lastName?: string;
}
export interface IDefaultEmployee {
	email: string;
	password: string;
	imageUrl: string;
	firstName?: string;
	lastName?: string;
	startedWorkOn?: string;
	endWork?: string;
	employeeLevel?: string;
}
export interface IDefaultCandidate {
	email: string;
	password: string;
	imageUrl: string;
	firstName?: string;
	lastName?: string;
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
	adminUsers: User[];
	employeeUsers: User[];
	candidateUsers: User[];
}
