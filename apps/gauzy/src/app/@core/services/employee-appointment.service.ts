import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	IEmployeeAppointment,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentFindInput,
	IEmployeeAppointmentUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class EmployeeAppointmentService {
	EMPLOYEE_APPOINTMENT_URL = `${API_PREFIX}/employee-appointment`;

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEmployeeAppointmentFindInput
	): Observable<{ items: IEmployeeAppointment[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<{ items: IEmployeeAppointment[] }>(
			this.EMPLOYEE_APPOINTMENT_URL,
			{
				params: { data }
			}
		);
	}

	decodeToken(token: string): Promise<string> {
		return this.http
			.get(this.EMPLOYEE_APPOINTMENT_URL + '/decode/' + token, {
				responseType: 'text'
			})
			.toPromise();
	}

	signAppointmentId(id: string): Promise<string> {
		return this.http
			.get(this.EMPLOYEE_APPOINTMENT_URL + '/sign/' + id, {
				responseType: 'text'
			})
			.toPromise();
	}

	getById(id: string = ''): Observable<IEmployeeAppointment> {
		return this.http.get<IEmployeeAppointment>(
			this.EMPLOYEE_APPOINTMENT_URL + '/' + id
		);
	}

	create(employeeAppointment: IEmployeeAppointmentCreateInput): Promise<any> {
		return this.http
			.post<IEmployeeAppointmentCreateInput>(
				`${this.EMPLOYEE_APPOINTMENT_URL}`,
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
			.put<IEmployeeAppointment>(
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
