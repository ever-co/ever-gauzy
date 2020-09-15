import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IAppointmentEmployees } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class AppointmentEmployeesService {
	URI = '/api/appointment-employees';

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: IAppointmentEmployees[] }> {
		return this.http
			.get<{ items: IAppointmentEmployees[] }>(this.URI)
			.pipe(first())
			.toPromise();
	}

	getById(id: string = ''): Observable<IAppointmentEmployees[]> {
		return this.http.get<IAppointmentEmployees[]>(this.URI + '/' + id);
	}

	findEmployeeAppointments(
		id: string = ''
	): Observable<IAppointmentEmployees[]> {
		return this.http.get<IAppointmentEmployees[]>(
			this.URI + '/findEmployeeAppointments/' + id
		);
	}

	add(
		appointmentEmployees: IAppointmentEmployees
	): Promise<IAppointmentEmployees> {
		return this.http
			.post<IAppointmentEmployees>(this.URI, appointmentEmployees)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		appointmentEmployees: IAppointmentEmployees
	): Promise<IAppointmentEmployees> {
		return this.http
			.put<IAppointmentEmployees>(
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
