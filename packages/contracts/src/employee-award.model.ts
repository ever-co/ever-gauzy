import { IRelationalEmployee } from './employee.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface IEmployeeAward extends IEmployeeAwardCreateInput {}

export interface IEmployeeAwardFindInput extends Partial<IEmployeeAwardUpdateInput>, IRelationalEmployee {}

export interface IEmployeeAwardCreateInput extends IEmployeeAwardUpdateInput, IRelationalEmployee {}

export interface IEmployeeAwardUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	year: string;
}