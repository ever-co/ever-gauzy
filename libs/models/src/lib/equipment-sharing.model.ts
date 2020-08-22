import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Employee } from './employee.model';
import { OrganizationTeam } from './organization-team-model';
import { Equipment } from './equipment.model';

export interface EquipmentSharing extends IBaseEntityModel {
	equipmentId?: string;
	shareRequestDay?: Date;
	shareStartDay?: Date;
	shareEndDay?: Date;
	status?: number;
	equipmentSharingPolicyId?: string;
	employees?: Employee[];
	teams?: OrganizationTeam[];
	equipment?: Equipment;
	name?: string;
	createdBy?: string;
	createdByName?: string;
	organizationId?: string;
}

export interface EquipmentSharingRequest extends IBaseEntityModel {
	equipmentId: string;
	equipment: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	equpmentSharingPolicyId?: string;
	employees?: string[];
	teams?: string[];
	organizationId?: string;
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}
