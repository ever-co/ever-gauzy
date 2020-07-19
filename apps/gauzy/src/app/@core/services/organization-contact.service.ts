import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationContactCreateInput,
	OrganizationContact,
	OrganizationContactFindInput,
	EditEntityByMemberInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationContactService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationContactCreateInput
	): Promise<OrganizationContact> {
		return this.http
			.post<OrganizationContact>('/api/organization-contact', createInput)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(id: string): Promise<OrganizationContact[]> {
		return this.http
			.get<OrganizationContact[]>(
				`/api/organization-contact/employee/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<OrganizationContact>(`/api/organization-contact/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: OrganizationContactFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationContact[]; total: number }>(
				`/api/organization-contact`,
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
	): Promise<OrganizationContactFindInput> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get(`/api/organization-contact`, { params: { data } })
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: EditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`/api/organization-contact/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-contact/${id}`)
			.pipe(first())
			.toPromise();
	}
}
