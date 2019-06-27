import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Organization } from '@gauzy/models';

@Injectable()
export class OrganizationsService {

    constructor(
        private http: HttpClient
    ) { }

    getAll(): Promise<{ items: Organization[], total: number }> {
        return this.http.get<{ items: Organization[], total: number }>(`/api/organization`).pipe(first()).toPromise()
    }
}