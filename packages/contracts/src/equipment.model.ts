import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEquipmentSharing } from './equipment-sharing.model';
import { ITag } from './tag-entity.model';
import { IImageAsset } from './product.model';
export interface IEquipment extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	type: string;
	image: IImageAsset;
	serialNumber?: string;
	manufacturedYear: number;
	initialCost: number;
	currency: string;
	maxSharePeriod: number;
	autoApproveShare: boolean;
	equipmentSharings: IEquipmentSharing[];
	tags: ITag[];
}

export interface IEquipmentFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	organizationId?: string;
}
