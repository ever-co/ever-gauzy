import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationTeams } from './organization-teams-model';
import { Equipment } from './equipment.model';

export interface EquipmentSharing extends IBaseEntityModel {
	equipmentId: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: string;
	employees: Employee[];
	teams: OrganizationTeams[];
	equipment: Equipment;
}

export interface EquipmentSharingRequest extends IBaseEntityModel {
	equipmentId: string;
	equipment: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: string;
	employees?: string[];
	teams?: string[];
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}
