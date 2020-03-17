import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	OrganizationEmploymentType,
	OrganizationEmploymentTypeFindInput,
	OrganizationEmploymentTypeCreateInput
} from '@gauzy/models';

@Injectable()
export class OrganizationEmploymentTypesService {
	constructor(private http: HttpClient) {}
	private readonly API_URL = '/api/organization-employment-type';

	getAll(
		relations?: string[],
		findInput?: OrganizationEmploymentTypeFindInput
	): Observable<{ items: OrganizationEmploymentType[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{
			items: OrganizationEmploymentType[];
			total: number;
		}>(this.API_URL, {
			params: { data }
		});
	}

	addEmploymentType(
		employmentType: OrganizationEmploymentTypeCreateInput
	): Observable<OrganizationEmploymentTypeCreateInput> {
		return this.http.post<OrganizationEmploymentTypeCreateInput>(
			this.API_URL,
			employmentType
		);
	}

	deleteEmploymentType(id: number): Promise<any> {
		return this.http
			.delete(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
