import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
	IOrganizationCreateInput,
	ITenantCreateInput,
	IUserRegistrationInput,
	IRoleMigrateInput,
	ITenant,
	IRolePermissionMigrateInput,
	IUserLoginInput,
} from '@gauzy/contracts';

@Injectable()
export class i4netCloudService {
	constructor(private readonly _http: HttpService) { }

	/**
	 * Extract user from cloud server
	 * Register user from local to cloud server
	 *
	 * @param params
	 * @returns
	 */
	migrateUser(
		params: IUserRegistrationInput
	): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/auth/register', params)
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}

	/**
	 * Extract Bearer Token from cloud server
	 * Login user from local to cloud server
	 *
	 * @param params
	 * @returns
	 */
	extractToken(params: IUserLoginInput): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/auth/login', params)
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}

	/**
	 * Migrate default tenant to the cloud server
	 *
	 * @param params
	 * @param token
	 * @returns
	 */
	migrateTenant(
		params: ITenantCreateInput,
		token: string
	): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/tenant', params, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}

	/**
	 * Migrate default organization to the cloud server
	 *
	 * @param params
	 * @param token
	 * @returns
	 */
	migrateOrganization(
		params: IOrganizationCreateInput,
		token: string
	): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/organization', params, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			})
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}

	/**
	 * Migrate roles to the cloud server
	 *
	 * @param params
	 * @param token
	 * @param tenant
	 * @returns
	 */
	migrateRoles(
		params: IRoleMigrateInput[],
		token: string,
		tenant: ITenant
	): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/roles/import/migrate', params, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Tenant-Id': `${tenant.id}`,
				},
			})
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}

	/**
	 * Migrate role permissions to the cloud server
	 *
	 * @param params
	 * @param token
	 * @param tenant
	 * @returns
	 */
	migrateRolePermissions(
		params: IRolePermissionMigrateInput[],
		token: string,
		tenant: ITenant
	): Observable<AxiosResponse<any, any>> {
		return this._http
			.post('/api/role-permissions/import/migrate', params, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Tenant-Id': `${tenant.id}`,
				},
			})
			.pipe(map((resp: AxiosResponse<any, any>) => resp));
	}
}
