import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserOrganizationFindInput, UserOrganization } from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable()
export class UsersOrganizationsService {

    constructor(
        private http: HttpClient
    ) { }

    findOne(findInput?: UserOrganizationFindInput): Observable<UserOrganization> {
        const findInputStr = JSON.stringify(findInput);

        return this.http.get<UserOrganization>(`/api/user-organization`, {
            params: { findInputStr }
        });
    }
}