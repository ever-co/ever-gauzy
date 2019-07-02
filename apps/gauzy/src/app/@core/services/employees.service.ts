import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Employee, EmployeeFindInput, EmployeeCreateInput as IEmployeeCreateInput } from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable()
export class EmployeesService {

    constructor(
        private http: HttpClient
    ) { }

    getAll(relations?: string[], findInput?: EmployeeFindInput): Observable<{ items: Employee[], total: number }> {
        const data = JSON.stringify({ relations, findInput });
        return this.http.get<{ items: Employee[], total: number }>(`/api/employee`, {
            params: { data }
        });
    }

    create(createInput: IEmployeeCreateInput): Observable<Employee> {
        return this.http.post<Employee>('/api/employee/create', createInput);
    }
}