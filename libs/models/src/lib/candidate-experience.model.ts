import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganization } from './organization.model';

export interface ICandidateExperience
	extends IBasePerTenantAndOrganizationEntityModel {
	occupation: string;
	duration: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	occupation?: string;
	duration?: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	occupation: string;
	duration: string;
	description?: string;
	candidateId?: string;
}
