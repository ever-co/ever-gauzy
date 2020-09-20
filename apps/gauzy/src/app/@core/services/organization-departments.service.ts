import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	IOrganizationDepartmentFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDepartmentsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationDepartmentCreateInput
	): Promise<IOrganizationDepartment> {
		return this.http
			.post<IOrganizationDepartment>(
				'/api/organization-department',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<IOrganizationDepartment[]> {
		return this.http
			.get<IOrganizationDepartment[]>(
				`/api/organization-department/employee/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IOrganizationDepartmentFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IOrganizationDepartment[]; total: number }>(
				`/api/organization-department`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(
		id: string,
		updateInput: IOrganizationDepartmentCreateInput
	): Promise<any> {
		return this.http
			.put(`/api/organization-department/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
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
