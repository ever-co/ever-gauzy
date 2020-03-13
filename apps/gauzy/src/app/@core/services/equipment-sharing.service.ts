import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { EquipmentSharing, EquipmentSharingRequest } from '@gauzy/models';

@Injectable()
export class EquipmentSharingService {
	EQUIPMENT_SHARING_URL = '/api/equipment-sharing';

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: EquipmentSharing[] }> {
		return this.http
			.get<{ items: EquipmentSharing[] }>(this.EQUIPMENT_SHARING_URL)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EQUIPMENT_SHARING_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(equipmentSharing: EquipmentSharingRequest): Promise<any> {
		return this.http
			.post<EquipmentSharingRequest>(
				this.EQUIPMENT_SHARING_URL,
				equipmentSharing
			)
			.pipe(first())
			.toPromise();
	}
}
