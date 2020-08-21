import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationProjectsCreateInput,
	OrganizationProjects,
	OrganizationProjectsFindInput,
	EditEntityByMemberInput,
	TaskListTypeEnum
} from '@gauzy/models';
import { first, take } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	constructor(private http: HttpClient) {}
	private readonly API_URL = '/api/organization-projects';
	create(
		createInput: OrganizationProjectsCreateInput
	): Promise<OrganizationProjects> {
		return this.http
			.post<OrganizationProjects>(this.API_URL, createInput)
			.pipe(first())
			.toPromise();
	}

	edit(
		editInput: Partial<OrganizationProjectsCreateInput & { id: string }>
	): Promise<OrganizationProjects> {
		return this.http
			.put<OrganizationProjects>(
				`${this.API_URL}/${editInput.id}`,
				editInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<OrganizationProjects[]> {
		return this.http
			.get<OrganizationProjects[]>(`${this.API_URL}/employee/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: OrganizationProjectsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationProjects[]; total: number }>(
				`${this.API_URL}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<OrganizationProjects>(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: EditEntityByMemberInput): Promise<any> {
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
