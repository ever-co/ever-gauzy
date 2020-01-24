import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationDepartmentCreateInput,
	OrganizationDepartment,
	OrganizationDepartmentFindInput,
	EditEntityByMemberInput
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

	getAllByEmployee(id: string): Promise<OrganizationDepartment[]> {
		return this.http
			.get<OrganizationDepartment[]>(
				`/api/organization-department/employee/${id}`
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

	updateByEmployee(updateInput: EditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`/api/organization-department/employee`, updateInput)
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
