import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEquipment, IEquipmentFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({ providedIn: 'root' })
export class EquipmentService {
	EQUIPMENT_URL = `${API_PREFIX}/equipment`;

	constructor(private http: HttpClient) {}

	getAll(relations?: string[], findInput?: IEquipmentFindInput): Promise<{ items: IEquipment[] }> {
		const data = JSON.stringify({ relations: relations || [], findInput });
		return firstValueFrom(
			this.http.get<{ items: IEquipment[] }>(`${this.EQUIPMENT_URL}`, {
				params: { data }
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.EQUIPMENT_URL}/${id}`));
	}

	save(equipment: IEquipment): Promise<IEquipment> {
		if (!equipment.id) {
			return firstValueFrom(this.http.post<IEquipment>(this.EQUIPMENT_URL, equipment));
		} else {
			return firstValueFrom(this.http.put<IEquipment>(`${this.EQUIPMENT_URL}/${equipment.id}`, equipment));
		}
	}
}
