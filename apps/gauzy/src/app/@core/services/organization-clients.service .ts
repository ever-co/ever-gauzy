import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationClientsCreateInput,
	OrganizationClients,
	OrganizationClientsFindInput,
	EditEntityByMemberInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationClientsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationClientsCreateInput
	): Promise<OrganizationClients> {
		return this.http
			.post<OrganizationClients>('/api/organization-clients', createInput)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<OrganizationClients[]> {
		return this.http
			.get<OrganizationClients[]>(
				`/api/organization-clients/employee/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<OrganizationClients>(`/api/organization-clients/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: OrganizationClientsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationClients[]; total: number }>(
				`/api/organization-clients`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getByName(
		relations?: string[],
		findInput?: string
	): Promise<OrganizationClientsFindInput> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get(`/api/organization-clients`, { params: { data } })
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: EditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`/api/organization-clients/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-clients/${id}`)
			.pipe(first())
			.toPromise();
	}
}
