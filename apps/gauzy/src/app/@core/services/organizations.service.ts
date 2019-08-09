import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Organization, OrganizationSelectInput } from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable()
export class OrganizationsService {

    constructor(
        private http: HttpClient
    ) { }

    getAll(): Observable<{ items: Organization[], total: number }> {
        return this.http.get<{ items: Organization[], total: number }>(`/api/organization`);
    }

    getById(id: string = '', select?: OrganizationSelectInput[]): Observable<Organization> {
        return this.http.get<Organization>(`/api/organization/${id}/${JSON.stringify(select || '')}`);
    }
}