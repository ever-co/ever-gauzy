import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IAppointmentEmployee } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class AppointmentEmployeesService {
	URI = `${API_PREFIX}/appointment-employees`;

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: IAppointmentEmployee[] }> {
		return firstValueFrom(this.http.get<{ items: IAppointmentEmployee[] }>(this.URI));
	}

	getById(id: string = ''): Observable<IAppointmentEmployee[]> {
		return this.http.get<IAppointmentEmployee[]>(this.URI + '/appointment/' + id);
	}

	findEmployeeAppointments(id: string = ''): Observable<IAppointmentEmployee[]> {
		return this.http.get<IAppointmentEmployee[]>(this.URI + '/employee-appointments/' + id);
	}

	add(appointmentEmployees: IAppointmentEmployee): Promise<IAppointmentEmployee> {
		return firstValueFrom(this.http.post<IAppointmentEmployee>(this.URI, appointmentEmployees));
	}

	update(id: string, appointmentEmployees: IAppointmentEmployee): Promise<IAppointmentEmployee> {
		return firstValueFrom(this.http.put<IAppointmentEmployee>(`${this.URI}/${id}`, appointmentEmployees));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.URI}/${id}`));
	}
}
