import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationDepartmentCreateInput,
	OrganizationDepartment,
	OrganizationDepartmentFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDepartmentsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationDepartmentCreateInput
	): Promise<OrganizationDepartment> {
		return this.http
			.post<OrganizationDepartment>(
				'/api/organization-department',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationDepartmentFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: OrganizationDepartment[]; total: number }>(
				`/api/organization-department`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-department/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-department/${id}`)
			.pipe(first())
			.toPromise();
	}
}
