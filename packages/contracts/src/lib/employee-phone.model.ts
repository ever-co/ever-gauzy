import { IEmployeeEntityInput } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeePhone extends IBasePerTenantAndOrganizationEntityModel, IEmployeeEntityInput {
	type: string;
	phoneNumber: string;
}

export interface IEmployeePhoneFindInput extends Partial<IEmployeePhone>, IEmployeeEntityInput {}

export interface IEmployeePhoneCreateInput extends IEmployeePhone, IEmployeeEntityInput {}

export interface IEmployeePhoneUpdateInput extends IEmployeePhoneCreateInput {}
