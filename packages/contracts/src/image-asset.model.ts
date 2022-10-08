import { IBasePerTenantAndOrganizationEntityModel } from "./base-entity.model";

export interface IImageAsset extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	url: string;
	width: number;
	height: number;
	isFeatured: boolean;
}