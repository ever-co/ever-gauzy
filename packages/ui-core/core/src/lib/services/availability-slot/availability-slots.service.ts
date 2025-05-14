import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	IAvailabilitySlot,
	IAvailabilitySlotsCreateInput,
	IAvailabilitySlotsFindInput,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class AvailabilitySlotsService {
	private http = inject(HttpClient);

	AVAILABILITY_SLOTS_BASE_URI = `${API_PREFIX}/availability-slots`;

	create(createInput: IAvailabilitySlotsCreateInput): Promise<any> {
		return firstValueFrom(this.http.post<IAvailabilitySlot>(this.AVAILABILITY_SLOTS_BASE_URI, createInput));
	}

	createBulk(createInput: IAvailabilitySlotsCreateInput[]): Promise<any> {
		return firstValueFrom(
			this.http.post<IAvailabilitySlot[]>(this.AVAILABILITY_SLOTS_BASE_URI + '/bulk', createInput)
		);
	}

	getAll(relations?: string[], findInput?: IAvailabilitySlotsFindInput): Promise<IPagination<IAvailabilitySlot>> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IPagination<IAvailabilitySlot>>(this.AVAILABILITY_SLOTS_BASE_URI, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IAvailabilitySlotsCreateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${this.AVAILABILITY_SLOTS_BASE_URI}/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.AVAILABILITY_SLOTS_BASE_URI}/${id}`));
	}
}
