import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Equipment } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EquipmentService {
	EQUIPMENT_URL = '/api/equipment';

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Equipment[] }> {
		return this.http
			.get<{ items: Equipment[] }>(`${this.EQUIPMENT_URL}`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EQUIPMENT_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	save(equipment: Equipment): Promise<Equipment> {
		if (!equipment.id) {
			return this.http
				.post<Equipment>(this.EQUIPMENT_URL, equipment)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<Equipment>(
					`${this.EQUIPMENT_URL}/${equipment.id}`,
					equipment
				)
				.pipe(first())
				.toPromise();
		}
	}
}
