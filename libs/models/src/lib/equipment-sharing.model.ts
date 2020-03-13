import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationTeams } from './organization-teams-model';

export interface EquipmentSharing extends IBaseEntityModel {
	equipmentId: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: string;
	employees: Employee[];
	teams: OrganizationTeams[];
}

export interface EquipmentSharingRequest {
	equipmentId: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: string;
	employee?: string;
	teams?: string;
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}
