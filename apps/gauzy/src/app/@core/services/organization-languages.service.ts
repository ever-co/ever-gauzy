import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationLanguagesCreateInput,
	IOrganizationLanguages,
	IOrganizationLanguagesFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

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
				`${API_PREFIX}/organization-languages`,
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
				`${API_PREFIX}/organization-languages`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-languages/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-languages/${id}`)
			.pipe(first())
			.toPromise();
	}
}
