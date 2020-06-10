import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationLanguagesCreateInput,
	OrganizationLanguages,
	OrganizationLanguagesFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationLanguagesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationLanguagesCreateInput
	): Promise<OrganizationLanguages> {
		return this.http
			.post<OrganizationLanguages>(
				'/api/organization-languages',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationLanguagesFindInput,
		relations?: string[]
	): Promise<{ items: OrganizationLanguages[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationLanguages[]; total: number }>(
				`/api/organization-languages`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-languages/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-languages/${id}`)
			.pipe(first())
			.toPromise();
	}
}
