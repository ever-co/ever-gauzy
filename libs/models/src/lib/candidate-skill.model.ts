import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSkill
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
}

export interface ISkillFindInput {
	name?: string;
	candidateId?: string;
}

export interface ISkillCreateInput {
	name: string;
	candidateId?: string;
}
