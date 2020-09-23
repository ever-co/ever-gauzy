import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ICandidateSkill
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
}

export interface ISkillFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	candidateId?: string;
}

export interface ISkillCreateInput
	extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	candidateId?: string;
}
