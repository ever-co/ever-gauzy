import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IEventType, IEventTypeFindInput, IEventTypeCreateInput, IEventTypeUpdateInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class EventTypeService {
	EVENT_TYPE_BASE_URI = `${API_PREFIX}/event-type`;

	constructor(private http: HttpClient) {}

	create(createInput: IEventTypeCreateInput): Promise<any> {
		return firstValueFrom(this.http.post<IEventType>(this.EVENT_TYPE_BASE_URI, createInput));
	}

	getEventTypeById(id: string, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http.get<IEventType>(`${this.EVENT_TYPE_BASE_URI}/${id}`, {
				params: { data }
			})
		);
	}

	getAll(relations?: string[], findInput?: IEventTypeFindInput): Promise<{ items: IEventType[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IEventType[]; total: number }>(this.EVENT_TYPE_BASE_URI, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IEventTypeUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${this.EVENT_TYPE_BASE_URI}/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.EVENT_TYPE_BASE_URI}/${id}`));
	}
}
