import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { JobPostSourceEnum } from './employee-job.model';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion
} from './job-matching.model';

export interface IJobSearchCategory extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	jobSourceCategoryId?: string;
	jobSource?: JobPostSourceEnum;
	jobPresetUpworkJobSearchCriterion?: IJobPresetUpworkJobSearchCriterion[];
	employeeUpworkJobSearchCriterion?: IEmployeeUpworkJobsSearchCriterion[];
}
