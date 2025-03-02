import { IRelationalOrganizationTeam } from './organization-team.model';
import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';

/**
 * Interface for entities that can have tags.
 */
export interface ITaggable {
	tags?: ITag[];
}

/**
 * Interface representing a Tag entity.
 */
export interface ITag extends IBasePerTenantAndOrganizationEntityModel, IRelationalOrganizationTeam {
	name: string;
	color: string;
	textColor?: string;
	icon?: string;
	description?: string;
	isSystem?: boolean;
	tagTypeId?: ID;
	tagType?: ITagType;
}

/**
 * Input interface for finding tags with optional filters.
 */
export interface ITagFindInput
	extends IBasePerTenantAndOrganizationEntityModel,
		Partial<
			Pick<ITag, 'name' | 'color' | 'textColor' | 'description' | 'isSystem' | 'tagTypeId' | 'organizationTeamId'>
		> {}

/**
 * Input interface for creating a tag.
 */
export interface ITagCreateInput extends Omit<ITag, 'createdAt' | 'updatedAt'> {}

/**
 * Input interface for updating a tag.
 */
export interface ITagUpdateInput extends Partial<ITagCreateInput> {}

/**
 * Interface representing a Tag Type entity.
 */
export interface ITagType extends IBasePerTenantAndOrganizationEntityModel, ITaggable {
	type: string;
}

/**
 * Input interface for creating a tag type.
 */
export interface ITagTypeCreateInput extends Omit<ITagType, 'createdAt' | 'updatedAt'> {}

/**
 * Input interface for updating a tag type.
 */
export interface ITagTypeUpdateInput extends Partial<ITagTypeCreateInput> {}

/**
 * Input interface for finding tag Type with optional filters.
 */
export interface ITagTypesFindInput extends IBasePerTenantAndOrganizationEntityModel, Partial<Pick<ITagType, 'type'>> {}

/**
 * Enum for default task tags.
 */
export enum TagEnum {
	MOBILE = 'Mobile',
	FRONTEND = 'Frontend',
	BACKEND = 'Backend',
	WEB = 'Web',
	UI_UX = 'UI/UX',
	FULL_STACK = 'Full-Stack',
	TABLET = 'Tablet',
	BUG = 'Bug'
}
