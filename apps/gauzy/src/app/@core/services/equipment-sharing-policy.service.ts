import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EquipmentSharingPolicy } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EquipmentSharingPolicyService {
	EQUIPMENT_SHARING_POLICY_URL = '/api/equipment-sharing-policy';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: EquipmentSharingPolicy
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: EquipmentSharingPolicy[]; total: number }>(
				`${this.EQUIPMENT_SHARING_POLICY_URL}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EQUIPMENT_SHARING_POLICY_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	save(
		equipmentSharingPolicy: EquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
		if (!equipmentSharingPolicy.id) {
			return this.http
				.post<EquipmentSharingPolicy>(
					this.EQUIPMENT_SHARING_POLICY_URL,
					equipmentSharingPolicy
				)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<EquipmentSharingPolicy>(
					`${this.EQUIPMENT_SHARING_POLICY_URL}/${equipmentSharingPolicy.id}`,
					equipmentSharingPolicy
				)
				.pipe(first())
				.toPromise();
		}
	}
}
