import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IEmployee } from './employee.model';
import { IOrganizationTeam } from './organization-team.model';
import { IEquipment } from './equipment.model';
import { IEquipmentSharingPolicy } from './equipment-sharing-policy.model';

export interface IEquipmentSharing extends IBasePerTenantAndOrganizationEntityModel {
	name: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	createdBy: string;
	createdByName: string;
	equipment: IEquipment;
	equipmentId: string;
	equipmentSharingPolicy: IEquipmentSharingPolicy;
	equipmentSharingPolicyId: string;
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
}

export interface IEquipmentSharingRequest extends IBasePerTenantAndOrganizationEntityModel {
	equipment?: IEquipment;
	equipmentId?: string;
	shareRequestDay: Date;
	shareStartDay: Date;
	shareEndDay: Date;
	status: number;
	equipmentSharingPolicy?: IEquipmentSharingPolicy;
	equipmentSharingPolicyId?: string;
	employees?: IEmployee[];
	teams?: IOrganizationTeam[];
}

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
