import { Injectable } from "@nestjs/common";
import { HttpService } from '@nestjs/axios'
import { AxiosResponse } from 'axios';
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import {
    IOrganizationCreateInput,
    ITenantCreateInput,
    IUserRegistrationInput,
    IRoleMigrateInput,
    ITenant,
    IRolePermissionMigrateInput,
    IUserLoginInput
} from "@gauzy/contracts";

@Injectable()
export class GauzyCloudService {

    constructor(
        private readonly _http: HttpService
    ) {}

    /**
     * Extract user from cloud server
     * Register user from local to cloud server
     *
     * @param payload
     * @returns
     */
    migrateUser(
        payload: IUserRegistrationInput
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/register', params).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }

    /**
     * Extract Bearer Token from cloud server
     * Login user from local to cloud server
     *
     * @param payload
     * @returns
     */
    extractToken(
        payload: IUserLoginInput
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/login', params).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }

    /**
     * Migrate default tenant to the cloud server
     *
     * @param payload
     * @param token
     * @returns
     */
    migrateTenant(
        payload: ITenantCreateInput,
        token: string
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/tenant', params, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }

    /**
     * Migrate default organization to the cloud server
     *
     * @param payload
     * @param token
     * @returns
     */
    migrateOrganization(
        payload: IOrganizationCreateInput,
        token: string
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/organization', params, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }

    /**
     * Migrate roles to the cloud server
     *
     * @param payload
     * @param token
     * @param tenant
     * @returns
     */
    migrateRoles(
        payload: IRoleMigrateInput[],
        token: string,
        tenant: ITenant
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/roles/import/migrate', params, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Tenant-Id': `${tenant.id}`
            }
        }).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }

    /**
     * Migrate role permissions to the cloud server
     *
     * @param payload
     * @param token
     * @param tenant
     * @returns
     */
    migrateRolePermissions(
        payload: IRolePermissionMigrateInput[],
        token: string,
        tenant: ITenant
    ): Observable<AxiosResponse<any, any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/role-permissions/import/migrate', params, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Tenant-Id': `${tenant.id}`
            }
        }).pipe(
            map((resp: AxiosResponse<any, any>) => resp),
        );
    }
}