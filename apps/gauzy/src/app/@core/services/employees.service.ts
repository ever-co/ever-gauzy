import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Employee } from '@gauzy/models';

@Injectable()
export class EmployeesService {

    constructor(
        private http: HttpClient
    ) { }

    getAll(): Promise<{ items: Employee[], total: number }> {
        return this.http.get<{ items: Employee[], total: number }>(`/api/employee`).pipe(first()).toPromise()
    }
}