import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { EmployeeAppointment } from '@gauzy/models';

@Injectable()
export class EmployeeAppointmentService {
	EMPLOYEE_APPOINTMENT_URL = '/api/employee-appointment';

	constructor(private http: HttpClient) {}

	getAll(): Observable<{ items: EmployeeAppointment[] }> {
		return this.http.get<{ items: EmployeeAppointment[] }>(
			this.EMPLOYEE_APPOINTMENT_URL
		);
	}

	getById(id: string = ''): Observable<EmployeeAppointment> {
		return this.http.get<EmployeeAppointment>(
			this.EMPLOYEE_APPOINTMENT_URL + '/' + id
		);
	}

	create(
		employeeAppointment: EmployeeAppointment
	): Promise<EmployeeAppointment> {
		return this.http
			.post<EmployeeAppointment>(
				`${this.EMPLOYEE_APPOINTMENT_URL}/create`,
				employeeAppointment
			)
			.pipe(first())
			.toPromise();
	}

	update(
		employeeAppointment: EmployeeAppointment
	): Promise<EmployeeAppointment> {
		return this.http
			.put<EmployeeAppointment>(
				`${this.EMPLOYEE_APPOINTMENT_URL}/${employeeAppointment.id}`,
				employeeAppointment
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.EMPLOYEE_APPOINTMENT_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
