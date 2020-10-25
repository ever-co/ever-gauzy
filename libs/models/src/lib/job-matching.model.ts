import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

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

export interface MatchingCriterions extends UpworkJobMatchingCriterions {}

export interface JobPreset extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
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
	occupationId?: string;
	categoryId?: string;
	keyword?: string;
}

export interface EmployeeUpworkJobsSearchCriterion
	extends IBasePerTenantAndOrganizationEntityModel {
	jobPresetId?: string;
	jobPreset?: JobPreset;
	employeeId?: string;
	employee?: IEmployee;
	occupationId?: string;
	categoryId?: string;
	keyword?: string;
}
