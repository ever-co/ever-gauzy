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

	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	dailyData: IAmountOwedReport[];

	private _filters: ITimeLogFilters;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(value: ITimeLogFilters) {
		this._filters = value || {};
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
				tap(() => this.getAmountsOwed()),
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

	async getAmountsOwed() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};

		this.loading = true;
		try {
			this.dailyData = await this.timesheetService.getOwedAmountReport(request);
		} catch (error) {
			console.log('Error while retrieving amounts owed reports', error);
		} finally {
			this.loading = false;
		}
	}
}
