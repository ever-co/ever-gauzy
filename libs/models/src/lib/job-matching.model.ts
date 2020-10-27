import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { JobPostSourceEnum } from './employee-job.model';
import { IEmployee } from './employee.model';
import { JobSearchCategory } from './job-search-category.model';
import { JobSearchOccupation } from './job-search-occupation.model';

export interface IEmployeeJobMatching {}

export interface JobMatchings {
	employeeId?: string;
	jobSource?: string;
	preset?: string;
	criterions?: MatchingCriterions[];
}

export interface UpworkJobMatchingCriterions {
	keywords?: string[];
	categories?: string[];
	occupations?: string[];
	hourly?: boolean;
	fixPrice?: boolean;
}

export interface MatchingCriterions
	extends EmployeeUpworkJobsSearchCriterion,
		JobPresetUpworkJobSearchCriterion {}

export interface JobPreset extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	employees?: Partial<IEmployee>[];
	employeeCriterions?: EmployeeUpworkJobsSearchCriterion[];
	jobPresetCriterions?: JobPresetUpworkJobSearchCriterion[];
}

export interface EmployeePresetInput {
	jobPresetIds?: string[];
	source?: JobPostSourceEnum;
	employeeId?: string;
}

export interface GetJobPresetInput {
	search?: string;
	organizationId?: string;
	employeeId?: string;
}
export interface EmployeeJobPreset
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: JobPreset;
	employeeId?: string;
	employee?: IEmployee;
}

export interface GetJobPresetCriterionInput {
	presetId?: string;
	employeeId?: string;
}

export interface JobPresetUpworkJobSearchCriterion
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: JobPreset;
	jobSearchOccupationId?: string;
	jobSearchOccupation?: JobSearchOccupation;
	jobSearchCategoryId?: string;
	jobSearchCategory?: JobSearchCategory;
	keyword?: string;
	hourly?: boolean;
	fixPrice?: boolean;
}

export interface EmployeeUpworkJobsSearchCriterion
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: JobPreset;
	employeeId?: string;
	employee?: IEmployee;
	jobSearchOccupationId?: string;
	jobSearchOccupation?: JobSearchOccupation;
	jobSearchCategoryId?: string;
	jobSearchCategory?: JobSearchCategory;
	keyword?: string;
	hourly?: boolean;
	fixPrice?: boolean;
}
