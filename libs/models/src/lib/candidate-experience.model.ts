import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IOrganization } from './organization.model';

export interface ICandidateExperience
	extends IBasePerTenantAndOrganizationEntityModel {
	occupation: string;
	duration: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceFindInput {
	occupation?: string;
	organization?: string;
	tenant?: string;
	duration?: string;
	description?: string;
	candidateId?: string;
}

export interface IExperienceCreateInput {
	occupation: string;
	organization: IOrganization;
	duration: string;
	description?: string;
	candidateId?: string;
}
