import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnInit
} from '@angular/core';
import {
	IAmountOwedReport,
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, tap } from 'rxjs/operators';
import { isEmpty } from '@gauzy/common-angular';
import { Store } from '../../../@core/services';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-amounts-owed-grid',
	templateUrl: './amounts-owed-grid.component.html',
	styleUrls: ['./amounts-owed-grid.component.scss']
})
export class AmountsOwedGridComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	logRequest: ITimeLogFilters = this.request;
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	dailyData: IAmountOwedReport[];

	@Input()
	set filters(filters: ITimeLogFilters) {
		this.logRequest = filters || {};
		this.subject$.next(true);
	}

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		private readonly cd: ChangeDetectorRef,
		public readonly translateService: TranslateService
	) {
		super(store, translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.getExpenses()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	filtersChange(filters: ITimeLogFilters) {
		this.logRequest = filters;
		this.subject$.next(true);
	}

	groupByChange() {
		this.subject$.next(true);
	}

	getExpenses() {
		if (!this.organization || isEmpty(this.logRequest)) {
			return;
		}
		this.loading = true;
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.logRequest),
			groupBy: this.groupBy
		};
		this.timesheetService
			.getOwedAmountReport(request)
			.then((logs) => {
				this.dailyData = logs;
			})
			.catch(() => {})
			.finally(() => (this.loading = false));
	}
}
