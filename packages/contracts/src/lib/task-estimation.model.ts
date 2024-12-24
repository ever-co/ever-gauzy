import { IEmployee } from './employee.model';
import { ITask } from './task.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITaskEstimation
	extends IBasePerTenantAndOrganizationEntityModel {
	estimate: number;
	employeeId: IEmployee['id'];
	taskId: ITask['id'];
}

export interface ITaskEstimationCreateInput extends ITaskEstimation {}

export interface ITaskEstimationUpdateInput
	extends Partial<ITaskEstimationCreateInput> {
	id?: string;
}

export interface ITaskEstimationFindInput
	extends IBasePerTenantAndOrganizationEntityModel {}
