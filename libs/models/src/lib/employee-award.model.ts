import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface IEmployeeAward extends IBaseEntityModel {
	name: string;
	employeeId: string;
	year: string;
  organization?: Organization;
  tenant: ITenant;
}

export interface IEmployeeAwardFindInput extends IBaseEntityModel {
	name?: string;
	employeeId?: string;
	year?: string;
}

export interface IEmployeeAwardCreateInput {
	name: string;
	employeeId: string;
	year: string;
}
