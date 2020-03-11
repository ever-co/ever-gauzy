import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class OrganizationEmpTypesService {
	constructor(private http: HttpClient) {}

	deleteEmployeeType(id: number): Promise<any> {
		return this.http
			.delete(`/api/empTypes/delType/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(empType): Promise<any> {
		return this.http
			.patch(`/api/empTypes/updateType/${empType.id}`, empType)
			.pipe(first())
			.toPromise();
	}
}
