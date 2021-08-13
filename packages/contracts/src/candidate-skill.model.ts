import { ICandidate } from './candidate.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSkill
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
	candidate?: ICandidate
}

export interface ISkillFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	candidateId?: string;
	candidate?: ICandidate
}

export interface ISkillCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
	candidate?: ICandidate
}
