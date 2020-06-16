import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Tag } from './tag-entity.model';
import { Employee } from './employee.model';
import { ITenant, Payment } from '@gauzy/models';

export interface User extends IBaseEntityModel {
	thirdPartyId?: string;
	name?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	employee?: Employee;
	employeeId?: string;
	tenant: ITenant;
	tags: Tag[];
	preferredLanguage?: string;
	payments?: Payment[];
	paymentsId?: string;
}

export interface UserFindInput extends IBaseEntityModel {
	thirdPartyId?: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	tags?: Tag[];
	preferredLanguage?: string;
}

export interface UserRegistrationInput {
	user: User;
	password?: string;
	originalUrl?: string;
	organizationId?: string;
	createdById?: string;
}

export interface UserCreateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	tags?: Tag[];
	preferredLanguage?: string;
}

export interface UserUpdateInput {
	firstName?: string;
	lastName?: string;
	email?: string;
	username?: string;
	role?: Role;
	roleId?: string;
	hash?: string;
	imageUrl?: string;
	preferredLanguage?: string;
}

export enum LanguagesEnum {
	ENGLISH = 'en',
	BULGARIAN = 'bg',
	HEBREW = 'he',
	RUSSIAN = 'ru'
}
