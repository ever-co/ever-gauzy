import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationProjectsCreateInput,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IEditEntityByMemberInput,
	IPagination,
	IEmployee,
	IOrganizationProjectsUpdateInput
} from '@gauzy/contracts';
import { firstValueFrom, take } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	private readonly API_URL = `${API_PREFIX}/organization-projects`;

	constructor(
		private readonly http: HttpClient
	) { }

	create(
		body: IOrganizationProjectsCreateInput
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http.post<IOrganizationProject>(this.API_URL, body)
		);
	}

	edit(
		body: Partial<IOrganizationProjectsUpdateInput>
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http.put<IOrganizationProject>(`${this.API_URL}/${body.id}`, body)
		);
	}

	getAllByEmployee(
		id: IEmployee['id'],
		where?: IOrganizationProjectsFindInput
	): Promise<IOrganizationProject[]> {
		return firstValueFrom(
			this.http.get<IOrganizationProject[]>(`${this.API_URL}/employee/${id}`, {
				params: toParams({ ...where })
			})
		);
	}

	getAll(
		relations: string[] = [],
		where?: IOrganizationProjectsFindInput
	): Promise<IPagination<IOrganizationProject>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationProject>>(`${this.API_URL}`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(id: IOrganizationProject['id']) {
		return firstValueFrom(
			this.http.get<IOrganizationProject>(`${this.API_URL}/${id}`)
		);
	}

	getCount(
		request: IOrganizationProjectsFindInput
	): Promise<number> {
		return firstValueFrom(
			this.http.get<number>(`${this.API_URL}/count`, {
				params: toParams({ ...request })
			})
		);
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${this.API_URL}/employee`, updateInput)
		);
	}

	updateTaskViewMode(
		id: IOrganizationProject['id'],
		body: IOrganizationProjectsUpdateInput
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http.put<IOrganizationProject>(`${this.API_URL}/task-view/${id}`, body).pipe(take(1))
		);
	}

	delete(id: IOrganizationProject['id']): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${this.API_URL}/${id}`)
		);
	}
}
