import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { JobPostSourceEnum, JobPostTypeEnum } from './employee-job.model';
import { IEmployee } from './employee.model';
import { IJobSearchCategory } from './job-search-category.model';
import { IJobSearchOccupation } from './job-search-occupation.model';

export interface IJobMatchings {
	employeeId?: string;
	jobSource?: string;
	preset?: string;
	criterions?: IMatchingCriterions[];
}

export interface IMatchingCriterions
	extends IEmployeeUpworkJobsSearchCriterion,
		IJobPresetUpworkJobSearchCriterion {}

export interface IJobPreset extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	employees?: Partial<IEmployee>[];
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}

export interface IEmployeePresetInput {
	jobPresetIds?: string[];
	source?: JobPostSourceEnum;
	employeeId?: string;
}

export interface IGetJobPresetInput {
	search?: string;
	organizationId?: string;
	employeeId?: string;
}

export interface IEmployeeJobPreset
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: IJobPreset;
	employeeId?: string;
	employee?: IEmployee;
}

export interface IGetJobPresetCriterionInput {
	presetId?: string;
	employeeId?: string;
}

export interface IJobPresetUpworkJobSearchCriterion
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: IJobPreset;
	occupationId?: string;
	occupation?: IJobSearchOccupation;
	categoryId?: string;
	category?: IJobSearchCategory;
	keyword?: string;
	jobType?: JobPostTypeEnum;
}

export interface IEmployeeUpworkJobsSearchCriterion
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	employee?: IEmployee;
	jobPresetId?: string;
	jobPreset?: IJobPreset;
	occupationId?: string;
	occupation?: IJobSearchOccupation;
	categoryId?: string;
	category?: IJobSearchCategory;
	keyword?: string;
	jobType?: JobPostTypeEnum;
}
