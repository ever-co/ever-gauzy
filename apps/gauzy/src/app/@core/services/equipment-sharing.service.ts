import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { EquipmentSharing } from '@gauzy/models';

@Injectable()
export class EquipmentSharingService {
	EQUIPMENT_SHARING_URL = '/api/equipment-sharing';

	constructor(private http: HttpClient) {}

	getAll(): Promise<EquipmentSharing[]> {
		return this.http
			.get<EquipmentSharing[]>(`${this.EQUIPMENT_SHARING_URL}`)
			.pipe(first())
			.toPromise();
	}

	getOrganization(id): Promise<EquipmentSharing[]> {
		return this.http
			.get<EquipmentSharing[]>(
				`${this.EQUIPMENT_SHARING_URL}/organization/` + id
			)
			.pipe(first())
			.toPromise();
	}

	getEmployee(id): Promise<EquipmentSharing[]> {
		return this.http
			.get<EquipmentSharing[]>(
				`${this.EQUIPMENT_SHARING_URL}/employee/` + id
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EQUIPMENT_SHARING_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(equipmentSharing: EquipmentSharing): Promise<EquipmentSharing> {
		return this.http
			.post<EquipmentSharing>(
				this.EQUIPMENT_SHARING_URL,
				equipmentSharing
			)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		equipmentSharing: EquipmentSharing
	): Promise<EquipmentSharing> {
		return this.http
			.put<EquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/${id}`,
				equipmentSharing
			)
			.pipe(first())
			.toPromise();
	}

	approval(id): Promise<EquipmentSharing> {
		return this.http
			.put<EquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/approval/${id}`,
				null
			)
			.pipe(first())
			.toPromise();
	}

	refuse(id): Promise<EquipmentSharing> {
		return this.http
			.put<EquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/refuse/${id}`,
				null
			)
			.pipe(first())
			.toPromise();
	}
}
