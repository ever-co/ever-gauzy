import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmployeeSetting, EmployeeSettingFindInput, } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class EmployeeSettingService {

    constructor(private http: HttpClient) { }

    create(createInput: EmployeeSetting): Promise<any> {
        return this.http.post<EmployeeSetting>('/api/employee-setting', createInput).pipe(first()).toPromise();
    }

    getAll(relations?: string[], findInput?: EmployeeSettingFindInput): Promise<{
        items: EmployeeSetting[],
        total: number
    }> {
        const data = JSON.stringify({ relations, findInput });

        return this.http.get<{
            items: EmployeeSetting[],
            total: number
        }>('/api/employee-setting', {
            params: { data }
        }).pipe(first()).toPromise();
    }

    delete(id: string): Promise<any> {
        return this.http.delete(`/api/employee-setting/${id}`).pipe(first()).toPromise();
    }

    update(id: string, updateInput: EmployeeSetting): Promise<any> {
        return this.http.put(`/api/employee-setting/${id}`, updateInput).pipe(first()).toPromise();
    }
}
