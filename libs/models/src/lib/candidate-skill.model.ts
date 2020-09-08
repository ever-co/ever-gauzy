import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';
export interface ISkill extends IBaseEntityModel {
	name: string;
	candidateId?: string;
}
export interface ISkillFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
}

export interface ISkillCreateInput {
	name: string;
	candidateId?: string;
}
