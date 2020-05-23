import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationContactsCreateInput,
	OrganizationContacts,
	OrganizationContactsFindInput,
	EditEntityByMemberInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationContactsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationContactsCreateInput
	): Promise<OrganizationContacts> {
		return this.http
			.post<OrganizationContacts>(
				'/api/organization-contacts',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<OrganizationContacts[]> {
		return this.http
			.get<OrganizationContacts[]>(
				`/api/organization-contacts/employee/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<OrganizationContacts>(`/api/organization-contacts/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: OrganizationContactsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationContacts[]; total: number }>(
				`/api/organization-contacts`,
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
	): Promise<OrganizationContactsFindInput> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get(`/api/organization-contacts`, { params: { data } })
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: EditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`/api/organization-contacts/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-contacts/${id}`)
			.pipe(first())
			.toPromise();
	}
}
