import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { JobPostSourceEnum } from './employee-job.model';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion
} from './job-matching.model';

export interface IJobSearchOccupation extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	jobSourceOccupationId?: string;
	jobSource?: JobPostSourceEnum;
	jobPresetUpworkJobSearchCriterion?: IJobPresetUpworkJobSearchCriterion[];
	employeeUpworkJobSearchCriterion?: IEmployeeUpworkJobsSearchCriterion[];
}
