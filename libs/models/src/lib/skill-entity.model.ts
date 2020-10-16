import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';

export interface ISkill extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	description?: string;
	color?: string;
	isSelected?: boolean;
	employees?: IEmployee[];
}

export interface ISkillName {
	name?: string;
}
