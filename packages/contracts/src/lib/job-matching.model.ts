import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { JobPostSourceEnum, JobPostTypeEnum } from './employee-job.model';
import { IEmployee } from './employee.model';
import { IJobSearchCategory } from './job-search-category.model';
import { IJobSearchOccupation } from './job-search-occupation.model';

export interface IJobMatchings {
	employeeId?: ID;
	jobSource?: string;
	preset?: string;
	criterions?: IMatchingCriterions[];
}

export interface IMatchingCriterions extends IEmployeeUpworkJobsSearchCriterion, IJobPresetUpworkJobSearchCriterion {}

export interface IGetMatchingCriterions {
	jobPresetId?: ID;
	employeeId?: ID;
}

export interface IJobPreset extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	employees?: Partial<IEmployee>[];
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}

export interface IEmployeePresetInput extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetIds?: string[];
	source?: JobPostSourceEnum;
	employeeId?: ID;
}

export interface IGetJobPresetInput extends IBasePerTenantAndOrganizationEntityModel {
	search?: string;
	employeeId?: ID;
}

export interface IEmployeeJobPreset extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: ID;
	jobPreset?: IJobPreset;
	employeeId?: ID;
	employee?: IEmployee;
}

export interface IGetJobPresetCriterionInput {
	presetId?: string;
	employeeId?: ID;
}

export interface IJobPresetUpworkJobSearchCriterion extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: ID;
	jobPreset?: IJobPreset;
	occupationId?: ID;
	occupation?: IJobSearchOccupation;
	categoryId?: ID;
	category?: IJobSearchCategory;
	keyword?: string;
	jobType?: JobPostTypeEnum;
}

export interface IEmployeeUpworkJobsSearchCriterion extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: ID;
	employee?: IEmployee;
	jobPresetId?: ID;
	jobPreset?: IJobPreset;
	occupationId?: ID;
	occupation?: IJobSearchOccupation;
	categoryId?: ID;
	category?: IJobSearchCategory;
	keyword?: string;
	jobType?: JobPostTypeEnum;
}
