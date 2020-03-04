import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class OrganizationEmpTypesService {
	constructor(private http: HttpClient) {}

	delType(id: string) {
		return this.http.delete(
			`http://localhost:3000/api/empTypes/delType/${id}`
		);
	}

	update(empType) {
		console.log(empType);
		return this.http.patch(
			`http://localhost:3000/api/empTypes/updateType/${empType.id}`,
			empType
		);
	}
}
