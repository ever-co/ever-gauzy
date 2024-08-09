import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationContactCreateInput,
	IOrganizationContact,
	IOrganizationContactFindInput,
	IEditEntityByMemberInput,
	IOrganizationContactUpdateInput,
	IEmployee
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationContactService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Create organization contact
	 *
	 * @param input
	 * @returns
	 */
	create(input: IOrganizationContactCreateInput): Promise<IOrganizationContact> {
		return firstValueFrom(this.http.post<IOrganizationContact>(`${API_PREFIX}/organization-contact`, input));
	}

	/**
	 * Update organization contact
	 *
	 * @param id
	 * @param input
	 * @returns
	 */
	update(id: IOrganizationContact['id'], input: IOrganizationContactUpdateInput): Promise<IOrganizationContact> {
		return firstValueFrom(this.http.put<IOrganizationContact>(`${API_PREFIX}/organization-contact/${id}`, input));
	}

	getAllByEmployee(id: IEmployee['id'], where?: IOrganizationContactFindInput): Promise<IOrganizationContact[]> {
		return firstValueFrom(
			this.http.get<IOrganizationContact[]>(`${API_PREFIX}/organization-contact/employee/${id}`, {
				params: toParams({ ...where })
			})
		);
	}

	getById(id: string, tenantId: string, relations?: string[]) {
		const data = JSON.stringify({ relations, tenantId });
		return firstValueFrom(
			this.http.get<IOrganizationContact>(`${API_PREFIX}/organization-contact/${id}`, {
				params: { data }
			})
		);
	}

	getAll(relations?: string[], findInput?: IOrganizationContactFindInput): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IOrganizationContact[]; total: number }>(`${API_PREFIX}/organization-contact`, {
				params: toParams({ data })
			})
		);
	}

	getByName(relations?: string[], findInput?: string): Promise<IOrganizationContactFindInput> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(this.http.get(`${API_PREFIX}/organization-contact`, { params: { data } }));
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-contact/employee`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/organization-contact/${id}`));
	}
}
