import { ITenant } from './tenant.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface Skill extends IBaseEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
	organizationId: string;
	tenant: ITenant;
}

export interface SkillName {
	name?: string;
}
