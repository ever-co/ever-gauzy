import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmployeeLevelInput } from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class EmployeeLevelService {
	constructor(private http: HttpClient) {}

	getAll(orgId: string) {
		return this.http.get(`/api/employee-level/${orgId}`);
	}

	create(employeeLevel: EmployeeLevelInput) {
		return this.http.post('/api/employee-level', employeeLevel);
	}

	delete(id: string) {
		return this.http.delete(`/api/employee-level/${id}`);
	}

	update(id: string, employeeLevel: EmployeeLevelInput) {
		return this.http.put(`/api/employee-level/${id}`, employeeLevel);
	}
}
