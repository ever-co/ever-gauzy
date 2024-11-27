import { IURLMetaData } from './timesheet.model';
import { IBasePerEntityType, IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IResourceLink extends IBasePerTenantAndOrganizationEntityModel, IBasePerEntityType {
	title: string;
	url: string;
	creator?: IUser;
	creatorId?: ID;
	metaData?: string | IURLMetaData;
}

export interface IResourceLinkCreateInput extends Omit<IResourceLink, 'creator' | 'creatorId'> {}

export interface IResourceLinkUpdateInput extends Partial<Omit<IResourceLinkCreateInput, 'entity' | 'entityId'>> {}

export interface IResourceLinkFindInput extends Pick<IResourceLink, 'entity' | 'entityId'> {}
