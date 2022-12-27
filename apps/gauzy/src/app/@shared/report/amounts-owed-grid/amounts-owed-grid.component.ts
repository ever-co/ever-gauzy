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
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import { DateRangePickerBuilderService, Store } from '../../../@core/services';
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

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly cd: ChangeDetectorRef,
		public readonly translateService: TranslateService,
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getAmountsOwed()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Get amount owed report
	 *
	 * @returns
	 */
	async getAmountsOwed() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			this.dailyData = await this.timesheetService.getOwedAmountReport(payloads);
		} catch (error) {
			console.log('Error while retrieving amounts owed reports', error);
		} finally {
			this.loading = false;
		}
	}
}
