import { IRelationalEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeePhone extends IBasePerTenantAndOrganizationEntityModel, IRelationalEmployee {
	type: string;
	phoneNumber: string;
}

export interface IEmployeePhoneFindInput extends Partial<IEmployeePhone>, IRelationalEmployee {}

export interface IEmployeePhoneCreateInput extends IEmployeePhone, IRelationalEmployee {}

export interface IEmployeePhoneUpdateInput extends IEmployeePhoneCreateInput {}
