import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IImageAsset as IDocumentAsset } from './image-asset.model';

export interface IOrganizationDocument extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	documentUrl: string;
	document?: IDocumentAsset | null;
	documentId?: IDocumentAsset['id'] | null;
}

export interface IOrganizationDocumentFindInput extends IBasePerTenantAndOrganizationEntityModel {
	name?: string;
}
