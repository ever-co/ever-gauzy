import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toParams, API_PREFIX } from '@gauzy/ui-core/common';
import { Observable } from 'rxjs';
import { IReportDayData, IGetInvoiceTimeLogs } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class InvoiceTimeLogsService {
	constructor(private readonly http: HttpClient) {}

	getInvoiceTimeLogs(request: IGetInvoiceTimeLogs): Observable<IReportDayData[]> {
		return this.http.get<IReportDayData[]>(`${API_PREFIX}/timesheet/time-log/invoice`, {
			params: toParams(request)
		});
	}
}
