import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
	IOrganization,
	IOrganizationCreateInput,
	IOrganizationFindInput,
	IOrganizationContactFindInput,
	IPagination,
	IOrganizationContact
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class OrganizationsService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationCreateInput): Promise<IOrganization> {
		return firstValueFrom(
			this.http
			.post<IOrganization>(`${API_PREFIX}/organization`, createInput)
		);
	}

	update(id: IOrganization['id'], updateInput: IOrganizationCreateInput): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/organization/${id}`, updateInput)
		);

	}

	delete(id: IOrganization['id']): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/organization/${id}`)
		);

	}

	getAll(
		where: IOrganizationFindInput,
		relations: string[] = [],
	): Promise<{ items: IOrganization[]; total: number }> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganization>>(`${API_PREFIX}/organization`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(
		id: IOrganization['id'],
		relations: string[] = []
	): Observable<IOrganization> {
		return this.http.get<IOrganization>( `${API_PREFIX}/organization/${id}`, {
			params: toParams({ relations })
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
		relations: string[] = []
	): Observable<IOrganization> {
		return this.http.get<IOrganization>(`${API_PREFIX}/public/organization/${profile_link}`, {
			params: toParams({ relations })
		});
	}

	/**
	 * GET public clients by organization
	 *
	 * @param request
	 * @returns
	 */
	getAllPublicClients(request: IOrganizationContactFindInput): Observable<IPagination<IOrganizationContact>> {
		return this.http.get<IPagination<IOrganizationContact>>(`${API_PREFIX}/public/organization/client`, {
			params: toParams(request)
		})
	}

	/**
	 * GET public client counts by organization
	 *
	 * @param request
	 * @returns
	 */
	getAllPublicClientCounts(request: IOrganizationContactFindInput): Observable<Number> {
		return this.http.get<Number>(`${API_PREFIX}/public/organization/client/count`, {
			params: toParams(request)
		})
	}

	/**
	 * GET public project counts by organization
	 *
	 * @param request
	 * @returns
	 */
	getAllPublicProjectCounts(request: IOrganizationContactFindInput): Observable<Number> {
		return this.http.get<Number>(`${API_PREFIX}/public/organization/project/count`, {
			params: toParams(request)
		})
	}
}
