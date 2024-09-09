import { IEmployeeEntityInput } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag.model';
import { IOrganizationContact } from './organization-contact.model';

export interface IIncome extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount: number;
	clientId?: IOrganizationContact['id'];
	client?: IOrganizationContact;
	currency: string;
	valueDate?: Date;
	notes?: string;
	isBonus: boolean;
	reference?: string;
	tags: ITag[];
}

export interface IIncomeCreateInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount: number;
	clientId: string;
	valueDate: Date;
	currency?: string;
	notes?: string;
	isBonus?: boolean;
	reference?: string;
	tags: ITag[];
}

export interface IIncomeUpdateInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount?: number;
	clientId?: string;
	valueDate?: Date;
	currency?: string;
	notes?: string;
	isBonus?: boolean;
	tags: ITag[];
}

export interface IIncomeFindInput extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	amount?: number;
	isBonus?: boolean;
	clientId?: string;
	valueDate?: Date;
	currency?: string;
}

export enum IncomeTypeEnum {
	HOURLY = 'Hourly'
}
