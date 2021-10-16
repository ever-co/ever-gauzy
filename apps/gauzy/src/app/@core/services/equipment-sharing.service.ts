import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IEquipmentSharing, IEquipmentSharingRequest } from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class EquipmentSharingService {
	EQUIPMENT_SHARING_URL = `${API_PREFIX}/equipment-sharing`;

	constructor(private http: HttpClient) {}

	getAll(): Promise<IEquipmentSharing[]> {
		return firstValueFrom(
			this.http
			.get<IEquipmentSharing[]>(`${this.EQUIPMENT_SHARING_URL}`)
		);
	}

	getByOrganizationId(id): Promise<IEquipmentSharing[]> {
		return firstValueFrom(
			this.http
			.get<IEquipmentSharing[]>(
				`${this.EQUIPMENT_SHARING_URL}/organization/` + id
			)
		);
	}

	getByAuthorUserId(id): Promise<IEquipmentSharing[]> {
		return firstValueFrom(
			this.http
			.get<IEquipmentSharing[]>(
				`${this.EQUIPMENT_SHARING_URL}/employee/` + id
			)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${this.EQUIPMENT_SHARING_URL}/${id}`)
		);
	}

	create(
		equipmentSharing: IEquipmentSharingRequest,
		id: string
	): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http
			.post<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/organization/${id}`,
				equipmentSharing
			)
		);
	}

	update(
		id: string,
		equipmentSharing: IEquipmentSharingRequest
	): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/${id}`,
				equipmentSharing
			)
		);
	}

	approval(id): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/approval/${id}`,
				null
			)
		);
	}

	refuse(id): Promise<IEquipmentSharing> {
		return firstValueFrom(
			this.http
			.put<IEquipmentSharing>(
				`${this.EQUIPMENT_SHARING_URL}/refuse/${id}`,
				null
			)
		);
	}
}
