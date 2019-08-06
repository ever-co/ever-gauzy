import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { EmployeeStatisticsFindInput, EmployeeStatistics } from '@gauzy/models';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EmployeeStatisticsService {
    constructor(private http: HttpClient) { }
    avarageBonus$ = new Subject<number>();

    getStatisticsByEmployeeId(employeeId: string, findInput?: EmployeeStatisticsFindInput): Promise<EmployeeStatistics> {
        const data = JSON.stringify({ findInput });

        return this.http.get<EmployeeStatistics>(`/api/employee-statistics/${employeeId}`, {
            params: { data }
        }).pipe(first()).toPromise();
    }
}
