import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEquipment, IEquipmentFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EquipmentService {
	EQUIPMENT_URL = '/api/equipment';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEquipmentFindInput
	): Promise<{ items: IEquipment[] }> {
		const data = JSON.stringify({ relations: relations || [], findInput });
		return this.http
			.get<{ items: IEquipment[] }>(`${this.EQUIPMENT_URL}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EQUIPMENT_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	save(equipment: IEquipment): Promise<IEquipment> {
		if (!equipment.id) {
			return this.http
				.post<IEquipment>(this.EQUIPMENT_URL, equipment)
				.pipe(first())
				.toPromise();
		} else {
			return this.http
				.put<IEquipment>(
					`${this.EQUIPMENT_URL}/${equipment.id}`,
					equipment
				)
				.pipe(first())
				.toPromise();
		}
	}
}
