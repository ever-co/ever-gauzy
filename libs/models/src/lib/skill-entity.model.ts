import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Skill extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface SkillName {
	name?: string;
}
