import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AppointmentEmployees } from '@gauzy/models';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class AppointmentEmployeesService {
	URI = '/api/appointment-employees';

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: AppointmentEmployees[] }> {
		return this.http
			.get<{ items: AppointmentEmployees[] }>(this.URI)
			.pipe(first())
			.toPromise();
	}

	getById(id: string = ''): Observable<AppointmentEmployees[]> {
		return this.http.get<AppointmentEmployees[]>(this.URI + '/' + id);
	}

	add(
		appointmentEmployees: AppointmentEmployees
	): Promise<AppointmentEmployees> {
		return this.http
			.post<AppointmentEmployees>(this.URI, appointmentEmployees)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		appointmentEmployees: AppointmentEmployees
	): Promise<AppointmentEmployees> {
		return this.http
			.put<AppointmentEmployees>(
				`${this.URI}/${id}`,
				appointmentEmployees
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.URI}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
