import { IBasePerTenantAndOrganizationEntityModel, ID } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IEquipment } from './equipment.model';
import { IEquipmentSharingPolicy } from './equipment-sharing-policy.model';

interface IEquipmentSharingAssociations {
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
}

// Base interface that contains the common properties for Equipment Sharing.
interface IBaseEquipmentSharing extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
}

// The full Equipment Sharing entity includes required relational fields.
export interface IEquipmentSharing extends IBaseEquipmentSharing, IEquipmentSharingAssociations {
	equipment: IEquipment;
	equipmentId: ID;
	equipmentSharingPolicy: IEquipmentSharingPolicy;
	equipmentSharingPolicyId: ID;
}

// Input interface for creating a new Equipment Sharing record.
// Note that the relational fields are optional here.
export interface IEquipmentSharingCreateInput extends IBaseEquipmentSharing {
	equipment?: IEquipment;
	equipmentId?: ID;
	equipmentSharingPolicy?: IEquipmentSharingPolicy;
	equipmentSharingPolicyId?: ID;
}

// Update input can simply extend the create input.
export interface IEquipmentSharingUpdateInput extends IEquipmentSharingCreateInput {}

export enum EquipmentSharingStatusEnum {
	REQUESTED = 'REQUESTED',
	APPROVED = 'APPROVED',
	REFUSED = 'REFUSED'
}

export interface ISelectedEquipmentSharing {
	data: IEquipmentSharing;
	isSelected: boolean;
}

export enum EquipmentSharingParticipantEnum {
	EMPLOYEE = 'EMPLOYEE',
	TEAM = 'TEAM'
}
