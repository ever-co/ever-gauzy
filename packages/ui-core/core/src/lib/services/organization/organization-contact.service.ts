import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationContactCreateInput,
	IOrganizationContact,
	IOrganizationContactFindInput,
	IEditEntityByMemberInput,
	IOrganizationContactUpdateInput,
	IEmployee,
	IPagination
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

	/**
	 * A page of contacts. `where` may carry `name`, `primaryEmail` or `primaryPhone` (each matched as a substring)
	 * and `members`, employee IDs whose contacts to return; `take` is the page size, at most 100, and `skip` the
	 * page, counted from 1.
	 */
	pagination(query: {
		where: Record<string, unknown>;
		order?: Record<string, 'ASC' | 'DESC'>;
		relations?: string[];
		skip?: number;
		take?: number;
	}): Promise<IPagination<IOrganizationContact>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationContact>>(`${API_PREFIX}/organization-contact/pagination`, {
				params: toParams(query)
			})
		);
	}

	/**
	 * A page of the contacts an employee can be assigned to, ordered by name: each one's id, name, picture and type
	 * only. It takes ORG_EMPLOYEES_EDIT (as assigning does), not ORG_CONTACT_VIEW. `name` is matched as a substring;
	 * `take` is the page size, at most 100, and `skip` the page, counted from 1.
	 */
	getAssignable(query: {
		organizationId: string;
		tenantId: string;
		name?: string;
		take?: number;
		skip?: number;
	}): Promise<IPagination<Pick<IOrganizationContact, 'id' | 'name' | 'imageUrl' | 'contactType'>>> {
		return firstValueFrom(
			this.http.get<IPagination<Pick<IOrganizationContact, 'id' | 'name' | 'imageUrl' | 'contactType'>>>(
				`${API_PREFIX}/organization-contact/assignable`,
				{ params: toParams(query) }
			)
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
