import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { IEquipmentSharing } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class EquipmentSharingService {
	EQUIPMENT_SHARING_URL = `${API_PREFIX}/equipment-sharing`;

	constructor(private http: HttpClient) {}

	getAll(): Promise<IEquipmentSharing[]> {
		return this.http
			.get<IEquipmentSharing[]>(`${this.EQUIPMENT_SHARING_URL}`)
			.pipe(first())
			.toPromise();
	}

	getOrganization(id): Promise<IEquipmentSharing[]> {
		return this.http
			.get<IEquipmentSharing[]>(
				`${this.EQUIPMENT_SHARING_URL}/organization/` + id
			)
			.pipe(first())
			.toPromise();
	}

	getEmployee(id): Promise<IEquipmentSharing[]> {
		return this.http
			.get<IEquipmentSharing[]>(
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

	create(
		equipmentSharing: IEquipmentSharing,
		id: string
	): Promise<IEquipmentSharing> {
		return this.http
			.post<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/organization/${id}`,
				equipmentSharing
			)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		equipmentSharing: IEquipmentSharing
	): Promise<IEquipmentSharing> {
		return this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/${id}`,
				equipmentSharing
			)
			.pipe(first())
			.toPromise();
	}

	approval(id): Promise<IEquipmentSharing> {
		return this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/approval/${id}`,
				null
			)
			.pipe(first())
			.toPromise();
	}

	refuse(id): Promise<IEquipmentSharing> {
		return this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/refuse/${id}`,
				null
			)
			.pipe(first())
			.toPromise();
	}
}
