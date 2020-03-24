import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { EquipmentSharing } from './equipment-sharing.model';

export interface Equipment extends IBaseEntityModel {
	name: string;
	type: string;
	serialNumber?: string;
	manufacturedYear: number;
	initialCost: number;
	currency: string;
	maxSharePeriod: number;
	autoApproveShare: boolean;
	equipmentSharings: EquipmentSharing[];
}
