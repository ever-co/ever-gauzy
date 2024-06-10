import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEquipmentSharingPolicy, IEquipmentSharingPolicyFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({ providedIn: 'root' })
export class EquipmentSharingPolicyService {
	EQUIPMENT_SHARING_POLICY_URL = `${API_PREFIX}/equipment-sharing-policy`;

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEquipmentSharingPolicyFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IEquipmentSharingPolicy[]; total: number }>(`${this.EQUIPMENT_SHARING_POLICY_URL}`, {
				params: { data }
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.EQUIPMENT_SHARING_POLICY_URL}/${id}`));
	}

	save(equipmentSharingPolicy: IEquipmentSharingPolicy): Promise<IEquipmentSharingPolicy> {
		if (!equipmentSharingPolicy.id) {
			return firstValueFrom(
				this.http.post<IEquipmentSharingPolicy>(this.EQUIPMENT_SHARING_POLICY_URL, equipmentSharingPolicy)
			);
		} else {
			return firstValueFrom(
				this.http.put<IEquipmentSharingPolicy>(
					`${this.EQUIPMENT_SHARING_POLICY_URL}/${equipmentSharingPolicy.id}`,
					equipmentSharingPolicy
				)
			);
		}
	}
}
