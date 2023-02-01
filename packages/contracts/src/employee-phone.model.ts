import { IRelationalEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeePhone extends IEmployeePhoneCreateInput {}

export interface IEmployeePhoneFindInput
	extends Partial<IEmployeePhoneUpdateInput>,
		IRelationalEmployee {}

export interface IEmployeePhoneCreateInput
	extends IEmployeePhoneUpdateInput,
		IRelationalEmployee {}

export interface IEmployeePhoneUpdateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	phoneNumber: string;
}
