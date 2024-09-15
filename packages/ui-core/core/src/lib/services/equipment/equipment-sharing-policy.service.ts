import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IEquipmentSharingPolicy, IEquipmentSharingPolicyFindInput, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({ providedIn: 'root' })
export class EquipmentSharingPolicyService {
	EQUIPMENT_SHARING_POLICY_URL = `${API_PREFIX}/equipment-sharing-policy`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Get all equipment sharing policies with optional filtering and relations.
	 *
	 * @param where - Conditions to filter the equipment sharing policies.
	 * @param relations - Optional relations to include in the result.
	 * @returns A promise that resolves to a paginated list of equipment sharing policies.
	 */
	getAll(
		where: IEquipmentSharingPolicyFindInput,
		relations: string[] = []
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		return firstValueFrom(
			this.http.get<IPagination<IEquipmentSharingPolicy>>(`${this.EQUIPMENT_SHARING_POLICY_URL}`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Delete an equipment sharing policy by ID.
	 *
	 * @param id - The ID of the equipment sharing policy to delete.
	 * @returns A promise that resolves when the equipment sharing policy has been deleted.
	 */
	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.EQUIPMENT_SHARING_POLICY_URL}/${id}`));
	}

	/**
	 * Create a new equipment sharing policy.
	 *
	 * @param input - The equipment sharing policy data to create.
	 * @returns A promise that resolves to the created equipment sharing policy.
	 */
	create(input: IEquipmentSharingPolicy): Promise<IEquipmentSharingPolicy> {
		return firstValueFrom(this.http.post<IEquipmentSharingPolicy>(this.EQUIPMENT_SHARING_POLICY_URL, input));
	}

	/**
	 * Update an existing equipment sharing policy.
	 *
	 * @param id - The ID of the equipment sharing policy to update.
	 * @param input - The updated equipment sharing policy data.
	 * @returns A promise that resolves to the updated equipment sharing policy.
	 */
	update(id: ID, input: IEquipmentSharingPolicy): Promise<IEquipmentSharingPolicy> {
		return firstValueFrom(
			this.http.put<IEquipmentSharingPolicy>(`${this.EQUIPMENT_SHARING_POLICY_URL}/${id}`, input)
		);
	}
}
