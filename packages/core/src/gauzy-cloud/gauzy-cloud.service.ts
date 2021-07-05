import { HttpService, Injectable } from "@nestjs/common";
import {
    IAuthLoginInput,
    IOrganizationCreateInput,
    ITenantCreateInput,
    IUserRegistrationInput
} from "@gauzy/contracts";
import { AxiosResponse } from 'axios';
import { Observable } from "rxjs/internal/Observable";

@Injectable()
export class GauzyCloudService {

    constructor(
        private readonly _http: HttpService
    ) {}
    
    migrateUser(payload: IUserRegistrationInput): Observable<AxiosResponse<any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/register', params);
    }

    extractToken(payload: IAuthLoginInput): Observable<AxiosResponse<any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/auth/login', params);
    }

    migrateTenant(
        payload: ITenantCreateInput, 
        token: string
    ): Observable<AxiosResponse<any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/tenant', params, { 
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });
    }

    migrateOrganization(
        payload: IOrganizationCreateInput, 
        token: string
    ): Observable<AxiosResponse<any>> {
        const params = JSON.stringify(payload);
        return this._http.post('/api/organization', params, { 
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });
    }
}