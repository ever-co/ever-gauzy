import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { JobPostSourceEnum } from './employee-job.model';
import {
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion
} from './job-matching.model';

export interface JobSearchCategory
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	jobSource?: JobPostSourceEnum;
	jobPresetUpworkJobSearchCriterion?: JobPresetUpworkJobSearchCriterion[];
	employeeUpworkJobSearchCriterion?: EmployeeUpworkJobsSearchCriterion[];
}
