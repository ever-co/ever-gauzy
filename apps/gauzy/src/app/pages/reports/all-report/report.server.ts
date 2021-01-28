import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	GetReportMenuItemsInput,
	IGetReport,
	IGetReportCategory,
	IPagination,
	IReport,
	UpdateReportMenuInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { Query, Store, StoreConfig } from '@datorama/akita';

export function initialTimesheetFilterState(): IReport[] {
	return [];
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'report-category', resettable: true })
export class TimesheetFilterStore extends Store<IReport[]> {
	constructor() {
		super(initialTimesheetFilterState());
	}
}

@Injectable({ providedIn: 'root' })
export class TimesheetFilterQuery extends Query<IReport[]> {
	constructor(protected store: TimesheetFilterStore) {
		super(store);
	}
}
@Injectable({
	providedIn: 'root'
})
export class ReportService {
	menuItems$ = this.reportQuery.select((state) => state);

	public get menuItems(): IReport[] {
		return this.reportQuery.getValue();
	}
	public set menuItems(value: IReport[]) {
		this.reportStore.reset();
		this.reportStore.update(value);
	}

	constructor(
		private http: HttpClient,
		protected reportStore: TimesheetFilterStore,
		protected reportQuery: TimesheetFilterQuery
	) {}

	getReportMenuItems(request: GetReportMenuItemsInput = {}) {
		return this.http
			.get<IReport[]>(`/api/report/menu-items`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise()
			.then((resp) => {
				this.menuItems = resp;
				return resp;
			});
	}

	getReports(request?: IGetReport) {
		return this.http
			.get<IPagination<IReport>>(`/api/report`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}

	updateReport(request?: UpdateReportMenuInput) {
		return this.http
			.post<IPagination<IReport>>(`/api/report/menu-item`, request)
			.pipe(first())
			.toPromise();
	}

	getReportCategories(request?: IGetReportCategory) {
		return this.http
			.get<IPagination<IReport>>(`/api/report/category`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}
}
