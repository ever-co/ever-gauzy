import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IAvailabilitySlot,
	IAvailabilitySlotsCreateInput,
	IAvailabilitySlotsFindInput
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class AvailabilitySlotsService {
	AVAILABILITY_SLOTS_BASE_URI = `${API_PREFIX}/availability-slots`;

	constructor(private http: HttpClient) { }

	create(createInput: IAvailabilitySlotsCreateInput): Promise<any> {
		return firstValueFrom(
			this.http
				.post<IAvailabilitySlot>(
					this.AVAILABILITY_SLOTS_BASE_URI,
					createInput
				)
		);
	}

	createBulk(createInput: IAvailabilitySlotsCreateInput[]): Promise<any> {
		return firstValueFrom(
			this.http
				.post<IAvailabilitySlot[]>(
					this.AVAILABILITY_SLOTS_BASE_URI + '/bulk',
					createInput
				)
		);
	}

	getAll(
		relations?: string[],
		findInput?: IAvailabilitySlotsFindInput
	): Promise<{ items: IAvailabilitySlot[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
				.get<{ items: IAvailabilitySlot[]; total: number }>(
					this.AVAILABILITY_SLOTS_BASE_URI,
					{
						params: { data }
					}
				)
		);
	}

	update(
		id: string,
		updateInput: IAvailabilitySlotsCreateInput
	): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${this.AVAILABILITY_SLOTS_BASE_URI}/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${this.AVAILABILITY_SLOTS_BASE_URI}/${id}`)
		);
	}
}
