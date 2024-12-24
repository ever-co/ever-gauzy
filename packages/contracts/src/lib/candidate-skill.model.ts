import { IRelationalCandidate } from './candidate.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSkill extends ICandidateSkillCreateInput {}

export interface ICandidateSkillFindInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	name?: string;
}
export interface ICandidateSkillCreateInput extends IBasePerTenantAndOrganizationEntityModel, IRelationalCandidate {
	name: string;
}

export interface ICandidateSkillUpdateInput extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
}