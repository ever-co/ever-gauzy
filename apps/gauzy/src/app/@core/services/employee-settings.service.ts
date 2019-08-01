import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmployeeSettings, EmployeeSettingsFindInput, } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class EmployeeSettingsService {

    constructor(private http: HttpClient) { }

    create(createInput: EmployeeSettings): Promise<any> {
        return this.http.post<EmployeeSettings>('/api/employee-settings', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: EmployeeSettingsFindInput): Promise<{
        items: EmployeeSettings[],
        total: number
    }> {
        const data = JSON.stringify({ relations, findInput });

        return this.http.get<{
            items: EmployeeSettings[],
            total: number
        }>('/api/employee-settings', {
            params: { data }
        }).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/employee-settings/${id}`).pipe(first()).toPromise();
    }

    update(id: string, updateInput: EmployeeSettings): Promise<any> {
        return this.http.put(`/api/employee-settings/${id}`, updateInput).pipe(first()).toPromise();
    }
}
