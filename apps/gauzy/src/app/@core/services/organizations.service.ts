import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganization,
	OrganizationSelectInput,
	IOrganizationCreateInput,
	IOrganizationFindInput
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class OrganizationsService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationCreateInput): Promise<IOrganization> {
		return this.http
			.post<IOrganization>(`${API_PREFIX}/organization`, createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IOrganizationCreateInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization/${id}`)
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
				`${API_PREFIX}/organization`,
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
			`${API_PREFIX}/organization/${id}/${JSON.stringify(select || '')}`,
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
			`${API_PREFIX}/organization/profile/${profile_link}/${JSON.stringify(
				select || ''
			)}/${option}`
		);
	}
}
