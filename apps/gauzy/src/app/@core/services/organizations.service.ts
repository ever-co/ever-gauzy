import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganization,
	OrganizationSelectInput,
	IOrganizationCreateInput,
	IOrganizationFindInput
} from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class OrganizationsService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationCreateInput): Promise<IOrganization> {
		return this.http
			.post<IOrganization>('/api/organization', createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IOrganizationCreateInput): Promise<any> {
		return this.http
			.put(`/api/organization/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IOrganizationFindInput
	): Promise<{ items: IOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IOrganization[]; total: number }>(
				`/api/organization`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(
		id: string = '',
		select?: OrganizationSelectInput[],
		relations?: string[]
	): Observable<IOrganization> {
		const data = JSON.stringify({ relations });
		return this.http.get<IOrganization>(
			`/api/organization/${id}/${JSON.stringify(select || '')}`,
			{
				params: { data }
			}
		);
	}

	getByProfileLink(
		profile_link: string = '',
		select?: OrganizationSelectInput[],
		relations?: string[]
	): Observable<IOrganization> {
		const option = JSON.stringify(relations || '');
		return this.http.get<IOrganization>(
			`/api/organization/profile/${profile_link}/${JSON.stringify(
				select || ''
			)}/${option}`
		);
	}
}
