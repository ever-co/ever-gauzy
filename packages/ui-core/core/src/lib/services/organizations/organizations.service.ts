import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import {
	IOrganization,
	IOrganizationCreateInput,
	IOrganizationFindInput,
	IOrganizationContactFindInput,
	IPagination,
	IOrganizationContact,
	IOptionsSelect,
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class OrganizationsService {

	constructor(private readonly http: HttpClient) { }

	create(body: IOrganizationCreateInput): Promise<IOrganization> {
		return firstValueFrom(this.http.post<IOrganization>(`${API_PREFIX}/organization`, body));
	}

	update(id: IOrganization['id'], body: IOrganizationCreateInput): Promise<IOrganization> {
		return firstValueFrom(this.http.put<IOrganization>(`${API_PREFIX}/organization/${id}`, body));
	}

	delete(id: IOrganization['id']): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/organization/${id}`));
	}

	getAll(where: IOrganizationFindInput, relations: string[] = []): Promise<IPagination<IOrganization>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganization>>(`${API_PREFIX}/organization`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(
		id: IOrganization['id'],
		relations: string[] = [],
		select: IOptionsSelect<IOrganization> = {}
	): Observable<IOrganization> {
		return this.http.get<IOrganization>(`${API_PREFIX}/organization/${id}`, {
			params: toParams({ relations, select })
		});
	}

	/**
	 * GET organization by profile link
	 *
	 * @param profile_link
	 * @returns
	 */
	getByProfileLink(
		profile_link: IOrganization['profile_link'],
		organizationId: IOrganization['id'],
		relations: string[] = []
	): Observable<IOrganization> {
		return this.http.get<IOrganization>(`${API_PREFIX}/public/organization/${profile_link}/${organizationId}`, {
			params: toParams({ relations })
		});
	}

	/**
	 * GET public clients by organization
	 *
	 * @param params
	 * @returns
	 */
	getAllPublicClients(params: IOrganizationContactFindInput): Observable<IPagination<IOrganizationContact>> {
		return this.http.get<IPagination<IOrganizationContact>>(`${API_PREFIX}/public/organization/client`, {
			params: toParams(params)
		});
	}

	/**
	 * GET public client counts by organization
	 *
	 * @param params
	 * @returns
	 */
	getAllPublicClientCounts(params: IOrganizationContactFindInput): Observable<number> {
		return this.http.get<number>(`${API_PREFIX}/public/organization/client/count`, {
			params: toParams(params)
		});
	}

	/**
	 * GET public project counts by organization
	 *
	 * @param params
	 * @returns
	 */
	getAllPublicProjectCounts(params: IOrganizationContactFindInput): Observable<number> {
		return this.http.get<number>(`${API_PREFIX}/public/organization/project/count`, {
			params: toParams(params)
		});
	}
}
