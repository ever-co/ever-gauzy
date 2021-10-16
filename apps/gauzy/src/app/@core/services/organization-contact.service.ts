import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationContactCreateInput,
	IOrganizationContact,
	IOrganizationContactFindInput,
	IEditEntityByMemberInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class OrganizationContactService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationContactCreateInput
	): Promise<IOrganizationContact> {
		return this.http
			.post<IOrganizationContact>(
				`${API_PREFIX}/organization-contact`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAllByEmployee(
		id: string,
		findInput?: IOrganizationContactFindInput
	): Promise<IOrganizationContact[]> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<IOrganizationContact[]>(
				`${API_PREFIX}/organization-contact/employee/${id}`,
				{
					params: toParams({ data })
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string, tenantId: string) {
		return this.http
			.get<IOrganizationContact>(
				`${API_PREFIX}/organization-contact/${id}`,
				{
					params: toParams({ tenantId })
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IOrganizationContactFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: IOrganizationContact[]; total: number }>(
				`${API_PREFIX}/organization-contact`,
				{ params: toParams({ data }) }
			)
		);
	}

	getByName(
		relations?: string[],
		findInput?: string
	): Promise<IOrganizationContactFindInput> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get(`${API_PREFIX}/organization-contact`, { params: { data } })
			.pipe(first())
			.toPromise();
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-contact/employee`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-contact/${id}`)
			.pipe(first())
			.toPromise();
	}
}
