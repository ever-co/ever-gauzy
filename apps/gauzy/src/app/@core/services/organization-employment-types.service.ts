import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { EmploymentTypesCreateInput } from '@gauzy/models';

@Injectable()
export class OrganizationEmploymentTypesService {
	constructor(private http: HttpClient) {}

	getEmploymentTypes(
		orgId: string
	): Observable<EmploymentTypesCreateInput[]> {
		return this.http.get<EmploymentTypesCreateInput[]>(
			`/api/employmentTypes/getEmploymentTypes/${orgId}`
		);
	}

	addEmploymentType(
		employmentType: EmploymentTypesCreateInput
	): Observable<EmploymentTypesCreateInput> {
		return this.http.post<EmploymentTypesCreateInput>(
			'/api/employmentTypes/add',
			employmentType
		);
	}

	deleteEmploymentType(id: number): Promise<any> {
		return this.http
			.delete(`/api/employmentTypes/deleteEmploymentType/${id}`)
			.pipe(first())
			.toPromise();
	}
}
