import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OrganizationClientsCreateInput, OrganizationClients, OrganizationClientsFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class OrganizationClientsService {
    constructor(private http: HttpClient) { }

    create(createInput: OrganizationClientsCreateInput): Promise<OrganizationClients> {
        return this.http.post<OrganizationClients>('/api/organization-clients', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: OrganizationClientsFindInput): Promise<{ items: any[], total: number }> {
        const data = JSON.stringify({ relations, findInput });

        return this.http.get<{ items: OrganizationClients[], total: number }>(`/api/organization-clients`, {
            params: { data }
        }).pipe(first()).toPromise();
    }

    update(id: string, updateInput: any): Promise<any> {
        return this.http.put(`/api/organization-clients/${id}`, updateInput).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/organization-clients/${id}`).pipe(first()).toPromise();
    }
}
