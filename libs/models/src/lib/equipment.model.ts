import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEquipmentSharing } from './equipment-sharing.model';
import { ITag } from './tag-entity.model';

export interface IEquipment extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	type: string;
	serialNumber?: string;
	manufacturedYear: number;
	initialCost: number;
	currency: string;
	maxSharePeriod: number;
	autoApproveShare: boolean;
	equipmentSharings: IEquipmentSharing[];
	tags: ITag[];
}
