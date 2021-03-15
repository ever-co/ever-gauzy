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
import { API_PREFIX } from '../../../@core/constants/app.constants';

export function initialReportFilterState(): IReport[] {
	return [];
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'report-category', resettable: true })
export class ReportFilterStore extends Store<IReport[]> {
	constructor() {
		super(initialReportFilterState());
	}
}

@Injectable({ providedIn: 'root' })
export class ReportFilterQuery extends Query<IReport[]> {
	constructor(protected store: ReportFilterStore) {
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
		protected reportStore: ReportFilterStore,
		protected reportQuery: ReportFilterQuery
	) {}

	getReportMenuItems(request: GetReportMenuItemsInput = {}) {
		return this.http
			.get<IReport[]>(`${API_PREFIX}/report/menu-items`, {
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
			.get<IPagination<IReport>>(`${API_PREFIX}/report`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}

	updateReport(request?: UpdateReportMenuInput) {
		return this.http
			.post<IPagination<IReport>>(
				`${API_PREFIX}/report/menu-item`,
				request
			)
			.pipe(first())
			.toPromise();
	}

	getReportCategories(request?: IGetReportCategory) {
		return this.http
			.get<IPagination<IReport>>(`${API_PREFIX}/report/category`, {
				params: request ? toParams(request) : {}
			})
			.pipe(first())
			.toPromise();
	}
}
