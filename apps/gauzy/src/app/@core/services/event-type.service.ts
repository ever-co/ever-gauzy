import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEventType,
	IEventTypeFindInput,
	IEventTypeCreateInput,
	IEventTypeUpdateInput,
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EventTypeService {
	EVENT_TYPE_BASE_URI = '/api/event-type';

	constructor(private http: HttpClient) {}

	create(createInput: IEventTypeCreateInput): Promise<any> {
		return this.http
			.post<IEventType>(this.EVENT_TYPE_BASE_URI, createInput)
			.pipe(first())
			.toPromise();
	}

	getEventTypeById(id: string, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return this.http
			.get<IEventType>(`${this.EVENT_TYPE_BASE_URI}/${id}`, {
				params: { data },
			})
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IEventTypeFindInput
	): Promise<{ items: IEventType[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IEventType[]; total: number }>(
				this.EVENT_TYPE_BASE_URI,
				{
					params: { data },
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IEventTypeUpdateInput): Promise<any> {
		return this.http
			.put(`${this.EVENT_TYPE_BASE_URI}/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EVENT_TYPE_BASE_URI}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
