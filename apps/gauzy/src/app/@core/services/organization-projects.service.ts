import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationProjectsCreateInput,
	OrganizationProjects,
	OrganizationProjectsFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationProjectsCreateInput
	): Promise<OrganizationProjects> {
		return this.http
			.post<OrganizationProjects>(
				'/api/organization-projects',
				createInput
			)
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
				`/api/organization-projects`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-projects/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-projects/${id}`)
			.pipe(first())
			.toPromise();
	}
}
