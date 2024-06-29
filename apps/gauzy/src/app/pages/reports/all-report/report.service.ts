import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	GetReportMenuItemsInput,
	IGetReport,
	IGetReportCategory,
	IPagination,
	IReport,
	UpdateReportMenuInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { Query, Store, StoreConfig } from '@datorama/akita';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { firstValueFrom } from 'rxjs';

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
		return firstValueFrom(
			this.http.get<IReport[]>(`${API_PREFIX}/report/menu-items`, {
				params: request ? toParams(request) : {}
			})
		).then((resp) => {
			this.menuItems = resp;
			return resp;
		});
	}

	getReports(request?: IGetReport) {
		return firstValueFrom(
			this.http.get<IPagination<IReport>>(`${API_PREFIX}/report`, {
				params: request ? toParams(request) : {}
			})
		);
	}

	updateReport(request?: UpdateReportMenuInput) {
		return firstValueFrom(this.http.post<IPagination<IReport>>(`${API_PREFIX}/report/menu-item`, request));
	}

	getReportCategories(request?: IGetReportCategory) {
		return firstValueFrom(
			this.http.get<IPagination<IReport>>(`${API_PREFIX}/report/category`, {
				params: request ? toParams(request) : {}
			})
		);
	}
}
