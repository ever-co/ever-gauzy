import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationContactCreateInput,
	IOrganizationContact,
	IOrganizationContactFindInput,
	IEditEntityByMemberInput
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationContactService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationContactCreateInput
	): Promise<IOrganizationContact> {
		return firstValueFrom(
			this.http
			.post<IOrganizationContact>(
				`${API_PREFIX}/organization-contact`,
				createInput
			)
		);
	}

	getAllByEmployee(
		id: string,
		findInput?: IOrganizationContactFindInput
	): Promise<IOrganizationContact[]> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
			.get<IOrganizationContact[]>(
				`${API_PREFIX}/organization-contact/employee/${id}`,
				{
					params: toParams({ data })
				}
			)
		);
	}

	getById(id: string, tenantId: string, relations?: string[]) {
		const data = JSON.stringify({ relations, tenantId });
		return firstValueFrom(
			this.http
			.get<IOrganizationContact>(
				`${API_PREFIX}/organization-contact/${id}`,
				{
					params: { data }
				}
			)
		);
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
		return firstValueFrom(
			this.http
			.get(`${API_PREFIX}/organization-contact`, { params: { data } })
		);
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/organization-contact/employee`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/organization-contact/${id}`)
		);
	}
}
