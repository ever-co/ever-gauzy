import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	IOrganizationDepartmentFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

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
				`${API_PREFIX}/organization-department`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<IOrganizationDepartment[]> {
		return this.http
			.get<IOrganizationDepartment[]>(
				`${API_PREFIX}/organization-department/employee/${id}`
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
				`${API_PREFIX}/organization-department`,
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
			.put(`${API_PREFIX}/organization-department/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-department/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-department/${id}`)
			.pipe(first())
			.toPromise();
	}
}
