import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeLevelInput,
	IEmployeeLevel,
	IEmployeeLevelFindInput,
	IPagination
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeLevelService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEmployeeLevelFindInput
	): Promise<IPagination<IEmployeeLevel>> {
		const data = JSON.stringify({ relations: relations || [], findInput });
		return this.http
			.get<IPagination<IEmployeeLevel>>(`${API_PREFIX}/employee-level`, {
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
