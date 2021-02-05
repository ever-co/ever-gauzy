import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeLevelInput,
	IEmployeeLevel,
	IEmployeeLevelFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeLevelService {
	constructor(private http: HttpClient) {}

	getAll(
		orgId: string,
		relations?: string[],
		findInput?: IEmployeeLevelFindInput
	): Promise<{
		items: IEmployeeLevel[];
		total: number;
	}> {
		const data = JSON.stringify({ relations: relations || [], findInput });
		return this.http
			.get<{
				items: IEmployeeLevel[];
				total: number;
			}>(`${API_PREFIX}/employee-level/${orgId}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(employeeLevel: IEmployeeLevelInput) {
		return this.http
			.post(`${API_PREFIX}/employee-level`, employeeLevel)
			.pipe(first())
			.toPromise();
	}

	delete(id: string) {
		return this.http
			.delete(`${API_PREFIX}/employee-level/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, employeeLevel: IEmployeeLevelInput) {
		return this.http
			.put(`${API_PREFIX}/employee-level/${id}`, employeeLevel)
			.pipe(first())
			.toPromise();
	}
}
