import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IEquipmentSharing,
	IEquipmentSharingCreateInput,
	IEquipmentSharingUpdateInput,
	IPagination,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class EquipmentSharingService {
	EQUIPMENT_SHARING_URL = `${API_PREFIX}/equipment-sharing`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves all equipment sharing records.
	 *
	 * @returns A promise that resolves to an array of equipment sharing records.
	 */
	getAll(): Promise<IEquipmentSharing[]> {
		return firstValueFrom(this.http.get<IEquipmentSharing[]>(`${this.EQUIPMENT_SHARING_URL}`));
	}

	/**
	 * Retrieves equipment sharing records for a specific organization.
	 *
	 * @param id - The unique identifier of the organization.
	 * @returns A promise that resolves to an array of equipment sharing records associated with the given organization.
	 */
	getByOrganizationId(id: ID): Promise<IPagination<IEquipmentSharing>> {
		return firstValueFrom(
			this.http.get<IPagination<IEquipmentSharing>>(`${this.EQUIPMENT_SHARING_URL}/organization/${id}`)
		);
	}

	/**
	 * Retrieves equipment sharing records by the author (employee) user ID.
	 *
	 * @param id - The unique identifier of the author user.
	 * @returns A promise that resolves to an array of equipment sharing records created by the specified user.
	 */
	getByEmployeeId(id: ID): Promise<IPagination<IEquipmentSharing>> {
		return firstValueFrom(
			this.http.get<IPagination<IEquipmentSharing>>(`${this.EQUIPMENT_SHARING_URL}/employee/${id}`)
		);
	}

	/**
	 * Deletes an equipment sharing record by its ID.
	 *
	 * @param id - The unique identifier of the equipment sharing record to delete.
	 * @returns A promise that resolves when the deletion is complete.
	 */
	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.EQUIPMENT_SHARING_URL}/${id}`));
	}

	/**
	 * Creates a new equipment sharing record for a specific organization.
	 *
	 * @param equipmentSharing - The input data required to create the equipment sharing record.
	 * @param organizationId - The ID of the organization that the record belongs to.
	 * @returns A promise that resolves to the newly created equipment sharing record.
	 */
	create(equipmentSharing: IEquipmentSharingCreateInput, organizationId: ID): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http.post<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/organization/${organizationId}`,
				equipmentSharing
			)
		);
	}

	/**
	 * Updates an existing equipment sharing record.
	 *
	 * @param id - The unique identifier of the equipment sharing record to update.
	 * @param input - The updated data for the equipment sharing record.
	 * @returns A promise that resolves to the updated equipment sharing record.
	 */
	update(id: ID, input: IEquipmentSharingUpdateInput): Promise<IEquipmentSharing> {
		return firstValueFrom(this.http.put<IEquipmentSharing>(`${this.EQUIPMENT_SHARING_URL}/${id}`, input));
	}

	/**
	 * Approves an equipment sharing request.
	 *
	 * @param id - The unique identifier of the equipment sharing record to approve.
	 * @returns A promise that resolves to the equipment sharing record updated with the approved status.
	 */
	approval(id: ID): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http.put<IEquipmentSharing>(`${this.EQUIPMENT_SHARING_URL}/approval/${id}`, {
				status: RequestApprovalStatusTypesEnum.APPROVED
			})
		);
	}

	/**
	 * Refuses an equipment sharing request.
	 *
	 * @param id - The unique identifier of the equipment sharing record to refuse.
	 * @returns A promise that resolves to the equipment sharing record updated with the refused status.
	 */
	refuse(id: ID): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http.put<IEquipmentSharing>(`${this.EQUIPMENT_SHARING_URL}/refuse/${id}`, {
				status: RequestApprovalStatusTypesEnum.REFUSED
			})
		);
	}
}
