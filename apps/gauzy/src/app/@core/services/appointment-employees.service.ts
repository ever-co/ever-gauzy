import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IAppointmentEmployee } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class AppointmentEmployeesService {
	URI = `${API_PREFIX}/appointment-employees`;

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: IAppointmentEmployee[] }> {
		return this.http
			.get<{ items: IAppointmentEmployee[] }>(this.URI)
			.pipe(first())
			.toPromise();
	}

	getById(id: string = ''): Observable<IAppointmentEmployee[]> {
		return this.http.get<IAppointmentEmployee[]>(this.URI + '/appointment/' + id);
	}

	findEmployeeAppointments(
		id: string = ''
	): Observable<IAppointmentEmployee[]> {
		return this.http.get<IAppointmentEmployee[]>(
			this.URI + '/employee-appointments/' + id
		);
	}

	add(
		appointmentEmployees: IAppointmentEmployee
	): Promise<IAppointmentEmployee> {
		return this.http
			.post<IAppointmentEmployee>(this.URI, appointmentEmployees)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		appointmentEmployees: IAppointmentEmployee
	): Promise<IAppointmentEmployee> {
		return this.http
			.put<IAppointmentEmployee>(
				`${this.URI}/${id}`,
				appointmentEmployees
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http.delete(`${this.URI}/${id}`).pipe(first()).toPromise();
	}
}
