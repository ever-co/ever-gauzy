import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ISkill extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
}

export interface ISkillName {
	name?: string;
}
