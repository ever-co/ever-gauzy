import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmployeeLevelInput, EmployeeLevel } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmployeeLevelService {
	constructor(private http: HttpClient) {}

	getAll(
		orgId: string,
		relations?: string[]
	): Promise<{
		items: EmployeeLevel[];
		total: number;
	}> {
<<<<<<< HEAD
		const data = JSON.stringify({ relations: relations || [] });
=======
		const data = JSON.stringify({ relations });
>>>>>>> f52301a95d9829730422253043050b61f859fcd2
		return this.http
			.get<{
				items: EmployeeLevel[];
				total: number;
			}>(`/api/employee-level/${orgId}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(employeeLevel: EmployeeLevelInput) {
		return this.http
			.post('/api/employee-level', employeeLevel)
			.pipe(first())
			.toPromise();
	}

	delete(id: string) {
		return this.http
			.delete(`/api/employee-level/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, employeeLevel: EmployeeLevelInput) {
		return this.http
			.put(`/api/employee-level/${id}`, employeeLevel)
			.pipe(first())
			.toPromise();
	}
}
