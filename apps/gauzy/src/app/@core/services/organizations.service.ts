import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	Organization,
	OrganizationSelectInput,
	OrganizationCreateInput
} from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class OrganizationsService {
	constructor(private http: HttpClient) {}

	create(createInput: OrganizationCreateInput): Promise<Organization> {
		return this.http
			.post<Organization>('/api/organization', createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: OrganizationCreateInput): Promise<any> {
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

	getAll(): Promise<{ items: Organization[]; total: number }> {
		return this.http
			.get<{ items: Organization[]; total: number }>(`/api/organization`)
			.pipe(first())
			.toPromise();
	}

	getById(
		id: string = '',
		select?: OrganizationSelectInput[]
	): Observable<Organization> {
		return this.http.get<Organization>(
			`/api/organization/${id}/${JSON.stringify(select || '')}`
		);
	}

	getByProfileLink(
		profile_link: string = '',
		select?: OrganizationSelectInput[]
	): Observable<Organization> {
		return this.http.get<Organization>(
			`/api/organization/profile/${profile_link}/${JSON.stringify(
				select || ''
			)}`
		);
	}
}
