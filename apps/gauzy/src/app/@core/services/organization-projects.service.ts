import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationProjectsCreateInput,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IEditEntityByMemberInput,
	TaskListTypeEnum
} from '@gauzy/contracts';
import { firstValueFrom, take } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	private readonly API_URL = `${API_PREFIX}/organization-projects`;

	constructor(private http: HttpClient) { }

	create(
		createInput: IOrganizationProjectsCreateInput
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http
				.post<IOrganizationProject>(this.API_URL, createInput)
		);
	}

	edit(
		editInput: Partial<IOrganizationProjectsCreateInput & { id: string }>
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this.http
				.put<IOrganizationProject>(
					`${this.API_URL}/${editInput.id}`,
					editInput
				)
		);
	}

	getAllByEmployee(
		id: string,
		findInput?: IOrganizationProjectsFindInput
	): Promise<IOrganizationProject[]> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
				.get<IOrganizationProject[]>(`${this.API_URL}/employee/${id}`, {
					params: toParams({ data })
				})
		);
	}

	getAll(
		relations: string[],
		findInput?: IOrganizationProjectsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
				.get<{ items: IOrganizationProject[]; total: number }>(
					`${this.API_URL}`,
					{
						params: toParams({ data })
					}
				)
		);
	}
	getById(id: string) {
		return firstValueFrom(
			this.http
				.get<IOrganizationProject>(`${this.API_URL}/${id}`)
		);
	}

	getCount(
		relations: string[],
		findInput?: IOrganizationProjectsFindInput
	): Promise<any> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
				.get<{ items: IOrganizationProject[]; total: number }>(
					`${this.API_URL}/count`,
					{
						params: toParams({ data })
					}
				)
		);
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${this.API_URL}/employee`, updateInput)
		);
	}

	updateTaskViewMode(
		id: string,
		taskViewMode: TaskListTypeEnum
	): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${this.API_URL}/task-view/${id}`, { taskViewMode })
				.pipe(take(1))
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${this.API_URL}/${id}`)
		);
	}
}
