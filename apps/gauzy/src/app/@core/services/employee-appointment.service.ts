import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	EmployeeAppointment,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentFindInput,
	IEmployeeAppointmentUpdateInput
} from '@gauzy/models';

@Injectable()
export class EmployeeAppointmentService {
	EMPLOYEE_APPOINTMENT_URL = '/api/employee-appointment';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEmployeeAppointmentFindInput
	): Observable<{ items: EmployeeAppointment[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<{ items: EmployeeAppointment[] }>(
			this.EMPLOYEE_APPOINTMENT_URL,
			{
				params: { data }
			}
		);
	}

	getById(id: string = ''): Observable<EmployeeAppointment> {
		return this.http.get<EmployeeAppointment>(
			this.EMPLOYEE_APPOINTMENT_URL + '/' + id
		);
	}

	create(employeeAppointment: IEmployeeAppointmentCreateInput): Promise<any> {
		return this.http
			.post<IEmployeeAppointmentCreateInput>(
				`${this.EMPLOYEE_APPOINTMENT_URL}/create`,
				employeeAppointment
			)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		employeeAppointment: IEmployeeAppointmentUpdateInput
	): Promise<any> {
		return this.http
			.put<EmployeeAppointment>(
				`${this.EMPLOYEE_APPOINTMENT_URL}/${id}`,
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
