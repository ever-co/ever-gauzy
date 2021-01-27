import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationProjectsCreateInput,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IEditEntityByMemberInput,
	TaskListTypeEnum
} from '@gauzy/contracts';
import { first, take } from 'rxjs/operators';
import { toParams } from '@gauzy/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	constructor(private http: HttpClient) {}
	private readonly API_URL = '/api/organization-projects';
	create(
		createInput: IOrganizationProjectsCreateInput
	): Promise<IOrganizationProject> {
		return this.http
			.post<IOrganizationProject>(this.API_URL, createInput)
			.pipe(first())
			.toPromise();
	}

	edit(
		editInput: Partial<IOrganizationProjectsCreateInput & { id: string }>
	): Promise<IOrganizationProject> {
		return this.http
			.put<IOrganizationProject>(
				`${this.API_URL}/${editInput.id}`,
				editInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(
		id: string,
		findInput?: IOrganizationProjectsFindInput
	): Promise<IOrganizationProject[]> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<IOrganizationProject[]>(`${this.API_URL}/employee/${id}`, {
				params: toParams({ data })
			})
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: IOrganizationProjectsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IOrganizationProject[]; total: number }>(
				`${this.API_URL}`,
				{
					params: toParams({ data })
				}
			)
			.pipe(first())
			.toPromise();
	}
	getById(id: string) {
		return this.http
			.get<IOrganizationProject>(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	getCount(
		relations: string[],
		findInput?: IOrganizationProjectsFindInput
	): Promise<any> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IOrganizationProject[]; total: number }>(
				`${this.API_URL}/count`,
				{
					params: toParams({ data })
				}
			)
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`${this.API_URL}/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	updateTaskViewMode(
		id: string,
		taskViewMode: TaskListTypeEnum
	): Promise<any> {
		return this.http
			.put(`${this.API_URL}/task-view/${id}`, { taskViewMode })
			.pipe(take(1))
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
