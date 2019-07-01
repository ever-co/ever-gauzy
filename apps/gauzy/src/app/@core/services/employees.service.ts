import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Employee, EmployeeFindInput } from '@gauzy/models';

@Injectable()
export class EmployeesService {

    constructor(
        private http: HttpClient
    ) { }

    getAll(relations?: string[], findInput?: EmployeeFindInput): Promise<{ items: Employee[], total: number }> {
        const data = JSON.stringify({ relations, findInput });
        return this.http.get<{ items: Employee[], total: number }>(`/api/employee`, {
            params: { data }
        }).pipe(first()).toPromise();
    }
}