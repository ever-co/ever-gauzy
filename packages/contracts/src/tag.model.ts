import { IRelationalOrganizationTeam } from './organization-team.model';
import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';

export interface ITaggable {
	tags?: ITag[];
}

export interface ITag extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
	name: string;
	color: string;
	textColor?: string;
	icon?: string;
	description?: string;
	isSystem?: boolean;
}

export interface ITagFindInput extends IBasePerTenantAndOrganizationEntityModel, Pick<ITag, 'organizationTeamId'> {
	name?: string;
	color?: string;
	textColor?: string;
	description?: string;
	isSystem?: boolean;
}

export interface ITagCreateInput extends ITag {}

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
