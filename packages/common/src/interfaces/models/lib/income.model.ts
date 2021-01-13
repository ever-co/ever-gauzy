import { IEmployee, IEmployeeFindInput } from './employee.model';
import { IOrganizationFindInput } from './organization.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { ITag } from './tag-entity.model';

export interface IIncome extends IBasePerTenantAndOrganizationEntityModel {
	employee?: IEmployee;
	employeeId?: string;
	amount: number;
	clientId?: string;
	clientName: string;
	currency: string;
	valueDate?: Date;
	notes?: string;
	isBonus?: boolean;
	tags: ITag[];
}

export interface IIncomeCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	amount: number;
	clientName: string;
	clientId: string;
	valueDate: Date;
	currency?: string;
	employeeId?: string;
	notes?: string;
	organizationId?: string;
	isBonus?: boolean;
	reference?: string;
	tags: ITag[];
}

export interface IIncomeUpdateInput {
	amount?: number;
	clientName?: string;
	clientId?: string;
	valueDate?: Date;
	employeeId?: string;
	currency?: string;
	notes?: string;
	isBonus?: boolean;
	tags: ITag[];
}

export interface IIncomeFindInput {
	employee?: IEmployeeFindInput;
	organization?: IOrganizationFindInput;
	tenantId?: string;
	amount?: number;
	isBonus?: boolean;
	clientId?: string;
	clientName?: string;
	valueDate?: Date;
	currency?: string;
}

export enum IncomeTypeEnum {
	HOURLY = 'Hourly'
}
