import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IEmployeeAward extends IBaseEntityModel {
	name: string;
	employeeId: string;
	year: string;
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
