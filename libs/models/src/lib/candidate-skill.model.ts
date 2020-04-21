import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
export interface Skill extends IBaseEntityModel {
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
