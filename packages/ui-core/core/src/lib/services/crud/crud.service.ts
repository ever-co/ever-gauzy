import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { ICrudService } from './icrud.service';

export abstract class CrudService<T> implements ICrudService<T> {
	constructor(protected readonly http: HttpClient, protected readonly API_URL: string) {}

	/**
	 * The create() method accepts a partial model as an argument and returns the created model from the server.
	 *
	 * @param entity
	 * @returns
	 */
	public create(entity: Partial<T>): Observable<T> {
		return this.http.post<T>(`${this.API_URL}`, entity).pipe(take(1));
	}

	/**
	 * The get() method returns an Observable with a list of all existing resources.
	 *
	 * @returns
	 */
	public get<T>(params?: Partial<T>): Observable<IPagination<T>> {
		return this.http.get<IPagination<T>>(`${this.API_URL}`, {
			params: toParams({ ...params })
		});
	}

	/**
	 * When we want to update an existing resource, we’ll use the update() method.
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	public update(id: any, entity: Partial<T>): Observable<T> {
		return this.http.put<T>(`${this.API_URL}/${id}`, entity).pipe(take(1));
	}

	/**
	 * When we want to delete an existing resource, we’ll use the delete() method.
	 *
	 * @param id
	 * @returns
	 */
	public delete(id: any): Observable<T> {
		return this.http.delete<T>(`${this.API_URL}/${id}`).pipe(take(1));
	}
}
