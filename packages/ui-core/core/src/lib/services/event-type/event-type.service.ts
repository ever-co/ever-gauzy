import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	IEventType,
	IEventTypeFindInput,
	IEventTypeCreateInput,
	IEventTypeUpdateInput,
	IPagination,
	ID
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class EventTypeService {
	API_BASE_URI = `${API_PREFIX}/event-type`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Creates a new event type.
	 *
	 * @param input - The input data to create a new event type.
	 * @returns An observable of the created event type.
	 */
	create(input: IEventTypeCreateInput): Promise<any> {
		return firstValueFrom(this.http.post<IEventType>(this.API_BASE_URI, input));
	}

	/**
	 * Gets an event type by ID.
	 *
	 * @param id - The ID of the event type to get.
	 * @param relations - Optional array of relations to include in the response.
	 * @returns An observable of the event type.
	 */
	getEventTypeById(id: ID, relations?: string[]) {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http.get<IEventType>(`${this.API_BASE_URI}/${id}`, {
				params: { data }
			})
		);
	}

	/**
	 * Gets all event types.
	 *
	 * @param relations
	 * @param findInput
	 * @returns
	 */
	getAll(relations?: string[], findInput?: IEventTypeFindInput): Promise<IPagination<IEventType>> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IPagination<IEventType>>(this.API_BASE_URI, {
				params: { data }
			})
		);
	}

	/**
	 * Updates an event type.
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	update(id: ID, input: IEventTypeUpdateInput): Promise<IEventType> {
		return firstValueFrom(this.http.put<IEventType>(`${this.API_BASE_URI}/${id}`, input));
	}

	/**
	 * Deletes an event type.
	 *
	 * @param id
	 * @returns
	 */
	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.API_BASE_URI}/${id}`));
	}
}
