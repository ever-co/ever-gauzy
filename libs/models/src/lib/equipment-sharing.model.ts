import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationTeam } from './organization-team-model';
import { Equipment } from './equipment.model';

export interface EquipmentSharing extends IBaseEntityModel {
	equipmentId: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	employees: Employee[];
	teams: OrganizationTeam[];
	equipment: Equipment;
}

export interface EquipmentSharingRequest extends IBaseEntityModel {
	equipmentId: string;
	equipment: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	employees?: string[];
	teams?: string[];
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}
