import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
	IOrganizationEmploymentType,
	IOrganizationEmploymentTypeFindInput,
	IOrganizationEmploymentTypeCreateInput
} from '@gauzy/contracts';

@Injectable()
export class OrganizationEmploymentTypesService {
	constructor(private http: HttpClient) {}
	private readonly API_URL = '/api/organization-employment-type';

	getAll(
		relations?: string[],
		findInput?: IOrganizationEmploymentTypeFindInput
	): Observable<{ items: IOrganizationEmploymentType[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{
			items: IOrganizationEmploymentType[];
			total: number;
		}>(this.API_URL, {
			params: { data }
		});
	}

	addEmploymentType(
		employmentType: IOrganizationEmploymentTypeCreateInput
	): Observable<IOrganizationEmploymentTypeCreateInput> {
		return this.http.post<IOrganizationEmploymentTypeCreateInput>(
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

	editEmploymentType(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-employment-type/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
