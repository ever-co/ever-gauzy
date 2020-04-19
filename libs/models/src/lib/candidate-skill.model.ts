import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface Skill extends IBaseEntityModel {
	name: string;
	candidateId: string;
}
export interface SkillFindInput extends IBaseEntityModel {
	name?: string;
	candidateId?: string;
}

export interface SkillCreateInput {
	name: string;
	candidateId: string;
}
