import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEquipmentSharingPolicy } from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable()
export class EquipmentSharingPolicyService {
	EQUIPMENT_SHARING_POLICY_URL = '/api/equipment-sharing-policy';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEquipmentSharingPolicy
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IEquipmentSharingPolicy[]; total: number }>(
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
		equipmentSharingPolicy: IEquipmentSharingPolicy
	): Promise<IEquipmentSharingPolicy> {
		if (!equipmentSharingPolicy.id) {
			return this.http
				.post<IEquipmentSharingPolicy>(
					this.EQUIPMENT_SHARING_POLICY_URL,
					equipmentSharingPolicy
				)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<IEquipmentSharingPolicy>(
					`${this.EQUIPMENT_SHARING_POLICY_URL}/${equipmentSharingPolicy.id}`,
					equipmentSharingPolicy
				)
				.pipe(first())
				.toPromise();
		}
	}
}
