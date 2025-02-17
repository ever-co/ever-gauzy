import { IURLMetaData } from './timesheet.model';
import { IBasePerEntityType, ID } from './base-entity.model';
import { IUser } from './user.model';

export interface IResourceLink extends IBasePerEntityType {
	title: string;
	url: string;
	createdBy?: IUser;
	createdById?: ID;
	metaData?: string | IURLMetaData;
}

export interface IResourceLinkCreateInput extends Omit<IResourceLink, 'createdBy' | 'createdById'> {}

export interface IResourceLinkUpdateInput extends Partial<Omit<IResourceLinkCreateInput, 'entity' | 'entityId'>> {}

export interface IResourceLinkFindInput extends Pick<IResourceLink, 'entity' | 'entityId'> {}
