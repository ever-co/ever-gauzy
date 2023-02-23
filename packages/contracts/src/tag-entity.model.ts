import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITag extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	color: string;
	icon?: string;
	description?: string;
	isSystem?: boolean;
}

export interface ITagFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
	color?: string;
	description?: string;
}

export interface ITagCreateInput extends ITag { }

export interface ITagUpdateInput extends Partial<ITagCreateInput> {
	id?: string;
}

/**
 * Default task tags
 */
export enum TagEnum {
	MOBILE = 'Mobile',
	FRONTEND = 'Frontend',
	BACKEND = 'Backend',
	WEB = 'WEB',
	UI_UX = 'UI/UX',
	FULL_STACK = 'Full-Stack',
	TABLET = 'Tablet',
	BUG = 'Bug'
}
