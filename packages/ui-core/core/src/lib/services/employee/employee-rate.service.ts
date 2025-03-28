import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmployeeHourlyRate, IGetEmployeeHourlyRateInput } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRateService {
	constructor(private readonly http: HttpClient) {}

	getEmployeeHourlyRate(request: IGetEmployeeHourlyRateInput): Observable<IEmployeeHourlyRate[]> {
		return this.http.get<IEmployeeHourlyRate[]>(`${API_PREFIX}/employee/rate`, {
			params: request ? toParams(request) : {}
		});
	}
}
