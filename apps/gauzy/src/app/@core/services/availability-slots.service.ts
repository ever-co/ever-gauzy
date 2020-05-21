import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IAvailabilitySlots,
	IAvailabilitySlotsCreateInput,
	IAvailabilitySlotsFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class AvailabilitySlotsService {
	AVAILIBILITY_SLOTS_BASE_URI = '/api/availability-slots';

	constructor(private http: HttpClient) {}

	create(createInput: IAvailabilitySlotsCreateInput): Promise<any> {
		return this.http
			.post<IAvailabilitySlots>(
				this.AVAILIBILITY_SLOTS_BASE_URI,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	createBulk(createInput: IAvailabilitySlotsCreateInput[]): Promise<any> {
		return this.http
			.post<IAvailabilitySlots[]>(
				this.AVAILIBILITY_SLOTS_BASE_URI + '/bulk',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IAvailabilitySlotsFindInput
	): Promise<{ items: IAvailabilitySlots[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IAvailabilitySlots[]; total: number }>(
				this.AVAILIBILITY_SLOTS_BASE_URI,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		updateInput: IAvailabilitySlotsCreateInput
	): Promise<any> {
		return this.http
			.put(`${this.AVAILIBILITY_SLOTS_BASE_URI}/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.AVAILIBILITY_SLOTS_BASE_URI}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
