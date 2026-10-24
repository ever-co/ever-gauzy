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
	/** The row's optimistic-concurrency version: 1 when filed, moved on by every write. */
	version?: number;
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
export interface IEquipmentSharingUpdateInput extends Partial<IEquipmentSharingCreateInput> {
	/**
	 * The version of the sharing the edit is based on. The edit is refused (409) when the stored row has moved on;
	 * omitted, the server uses the version it reads.
	 */
	version?: number;
}

/**
 * The input of the in-place, version-checked edit of a sharing (`PUT /equipment-sharing/:id/in-place`, GraphQL
 * `updateEquipmentSharingInPlace`). The row is updated where it is, rather than removed and filed again, and only at
 * the version the edit is based on: refused with 409 `ENTITY_VERSION_CONFLICT` when the stored row has moved on. A
 * member left out keeps its stored value; `employees` / `teams`, when stated, replace the sharing's members.
 */
export interface IEquipmentSharingUpdateInPlaceInput extends IEquipmentSharingUpdateInput, IEquipmentSharingAssociations {
	/** The version of the sharing the edit is based on. Required: it is what the edit is a compare-and-set on. */
	version: number;
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
