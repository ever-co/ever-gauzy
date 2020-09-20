import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationLanguagesCreateInput,
	IOrganizationLanguages,
	IOrganizationLanguagesFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationLanguagesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationLanguagesCreateInput
	): Promise<IOrganizationLanguages> {
		return this.http
			.post<IOrganizationLanguages>(
				'/api/organization-languages',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationLanguagesFindInput,
		relations?: string[]
	): Promise<{ items: IOrganizationLanguages[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IOrganizationLanguages[]; total: number }>(
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
