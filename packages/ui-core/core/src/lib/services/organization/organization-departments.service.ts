import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IOrganizationDepartment,
	IOrganizationDepartmentCreateInput,
	IOrganizationDepartmentFindInput
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationDepartmentsService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationDepartmentCreateInput): Promise<IOrganizationDepartment> {
		return firstValueFrom(
			this.http.post<IOrganizationDepartment>(`${API_PREFIX}/organization-department`, createInput)
		);
	}

	getAllByEmployee(id: string): Promise<IOrganizationDepartment[]> {
		return firstValueFrom(
			this.http.get<IOrganizationDepartment[]>(`${API_PREFIX}/organization-department/employee/${id}`)
		);
	}

	getAll(
		relations?: string[],
		findInput?: IOrganizationDepartmentFindInput,
		order?: {}
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, order });
		return firstValueFrom(
			this.http.get<{ items: IOrganizationDepartment[]; total: number }>(
				`${API_PREFIX}/organization-department`,
				{
					params: { data }
				}
			)
		);
	}

	update(id: string, updateInput: IOrganizationDepartmentCreateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-department/${id}`, updateInput));
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-department/employee`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/organization-department/${id}`));
	}
}
