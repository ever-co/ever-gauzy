import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IGetReport,
	IGetReportCategory,
	IPagination,
	IReport,
	IReportCategory
} from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class ReportService {
	constructor(private http: HttpClient) {}

	getReports(request?: IGetReport) {
		return this.http
			.get<IPagination<IReport>>(`/api/report`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}

	getReportCategories(request?: IGetReportCategory) {
		return this.http
			.get<IPagination<IReportCategory>>(`/api/report`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}
}
