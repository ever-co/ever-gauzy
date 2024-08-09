import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';
import {
	IOrganizationEmploymentType,
	IOrganizationEmploymentTypeFindInput,
	IOrganizationEmploymentTypeCreateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationEmploymentTypesService {
	private readonly API_URL = `${API_PREFIX}/organization-employment-type`;

	constructor(private http: HttpClient) {}

	getAllWithPagination(
		findInput?: IOrganizationEmploymentTypeFindInput,
		relations?: string[]
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{ items: IOrganizationEmploymentType[]; total: number }>(this.API_URL, {
				params: { data }
			})
		);
	}

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
		return this.http.post<IOrganizationEmploymentTypeCreateInput>(this.API_URL, employmentType);
	}

	deleteEmploymentType(id: number): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.API_URL}/${id}`));
	}

	editEmploymentType(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-employment-type/${id}`, updateInput));
	}
}
