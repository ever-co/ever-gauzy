import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team-model';
import { IEquipment } from './equipment.model';

export interface IEquipmentSharing
	extends IBasePerTenantAndOrganizationEntityModel {
	equipmentId?: string;
	shareRequestDay?: Date;
	shareStartDay?: Date;
	shareEndDay?: Date;
	status?: number;
	equipmentSharingPolicyId?: string;
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
	equipment?: IEquipment;
	name?: string;
	createdBy?: string;
	createdByName?: string;
}

export interface IEquipmentSharingRequest {
	equipmentId: string;
	equipment: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	equipmentSharingPolicyId?: string;
	employees?: string[];
	teams?: string[];
	organizationId?: string;
}

export enum EquipmentSharingStatusEnum {
	ACTIVE = 'Active',
	REQUESTED = 'Requested',
	APPROVED = 'Approved'
}

export interface ISelectedEquipmentSharing {
	data: IEquipmentSharing;
	isSelected: boolean;
}
