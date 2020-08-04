import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface EquipmentSharingPolicy extends IBaseEntityModel {
	name?: string;
	organizationId?: string;
	description?: string;
}
