import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IExpenseReportData,
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { isEmpty } from '@gauzy/common-angular';
import { debounceTime, tap } from 'rxjs/operators';
import { ExpensesService, Store } from '../../../@core/services';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expenses-report-grid',
	templateUrl: './expenses-report-grid.component.html',
	styleUrls: ['./expenses-report-grid.component.scss']
})
export class ExpensesReportGridComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	dailyData: IExpenseReportData[] = [];
	weekDayList: string[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	private _filters: ITimeLogFilters;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value || {};
		this.subject$.next(true);
	}

	constructor(
		private readonly expensesService: ExpensesService,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	groupByChange() {
		this.subject$.next(true);
	}

	async getExpenses() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.loading = true;
		try {
			this.dailyData = await this.expensesService .getDailyExpensesReport(request);
		} catch (error) {
			console.log('Error while retrieving expense reports', error);
		} finally {
			this.loading = false;
		}
	}
}
