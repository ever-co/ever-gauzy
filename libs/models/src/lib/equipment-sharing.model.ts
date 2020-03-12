import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EquipmentSharing extends IBaseEntityModel {
	equipmentId: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: string;
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}
