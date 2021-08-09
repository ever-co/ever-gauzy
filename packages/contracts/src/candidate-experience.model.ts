import { ICandidate } from './candidate.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateExperience
	extends IBasePerTenantAndOrganizationEntityModel {
	occupation: string;
	duration: string;
	description?: string;
	candidateId?: string;
	candidate?: ICandidate;
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
