import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
	ID,
	IEmployeeAppointment,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentFindInput,
	IEmployeeAppointmentUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class EmployeeAppointmentService {
	API_URL = `${API_PREFIX}/employee-appointment`;

	constructor(private http: HttpClient) {}

	/**
	 * Get all employee appointments.
	 *
	 * @param relations
	 * @param findInput
	 * @returns
	 */
	getAll(
		relations?: string[],
		findInput?: IEmployeeAppointmentFindInput
	): Observable<{ items: IEmployeeAppointment[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<{ items: IEmployeeAppointment[] }>(this.API_URL, {
			params: { data }
		});
	}

	/**
	 * Decode token
	 *
	 * @param token
	 * @returns
	 */
	decodeToken(token: string): Promise<string> {
		return firstValueFrom(this.http.get(this.API_URL + '/decode/' + token, { responseType: 'text' }));
	}

	/**
	 * signAppointmentId
	 *
	 * @param id
	 * @returns
	 */
	signAppointmentId(id: ID): Promise<string> {
		return firstValueFrom(this.http.get(this.API_URL + '/sign/' + id, { responseType: 'text' }));
	}

	/**
	 * Get an employee appointment by ID.
	 *
	 * @param id
	 * @param relations
	 * @returns
	 */
	getById(id: ID, relations: string[] = []): Observable<IEmployeeAppointment> {
		return this.http.get<IEmployeeAppointment>(this.API_URL + '/' + id, { params: toParams({ relations }) });
	}

	/**
	 * Create an employee appointment.
	 *
	 * @param input
	 * @returns
	 */
	create(input: IEmployeeAppointmentCreateInput): Promise<any> {
		return firstValueFrom(this.http.post<IEmployeeAppointmentCreateInput>(`${this.API_URL}`, input));
	}

	/**
	 * Update an employee appointment by ID.
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	update(id: ID, input: IEmployeeAppointmentUpdateInput): Promise<IEmployeeAppointment> {
		return firstValueFrom(this.http.put<IEmployeeAppointment>(`${this.API_URL}/${id}`, input));
	}

	/**
	 * Delete an employee appointment by ID.
	 *
	 * @param id
	 * @returns
	 */
	delete(id: ID): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.API_URL}/${id}`));
	}
}
