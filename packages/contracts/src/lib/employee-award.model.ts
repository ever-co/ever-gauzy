import { IEmployeeEntityInput } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeeAward extends IEmployeeAwardCreateInput {}

export interface IEmployeeAwardFindInput extends Partial<IEmployeeAwardUpdateInput>, IEmployeeEntityInput {}

export interface IEmployeeAwardCreateInput extends IEmployeeAwardUpdateInput, IEmployeeEntityInput {}

export interface IEmployeeAwardUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	year: string;
}
