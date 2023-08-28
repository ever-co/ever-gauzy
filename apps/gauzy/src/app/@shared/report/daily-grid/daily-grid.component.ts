import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	Input,
	OnDestroy,
	OnInit
} from '@angular/core';
import {
	IGetTimeLogReportInput,
	IReportDayData,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pick } from 'underscore';
import { distinctUntilChange, isEmpty, progressStatus } from '@gauzy/common-angular';
import { Environment } from '@env/model';
import { environment } from '@env/environment';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService, Store } from '../../../@core/services';
import { TimesheetService } from '../../timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from '../../timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-daily-grid',
	templateUrl: './daily-grid.component.html',
	styleUrls: ['./daily-grid.component.scss']
})
export class DailyGridComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit, OnDestroy {

	// This constant holds the URL for downloading content from the platform's website.
	readonly PLATFORM_WEBSITE_DOWNLOAD_URL: Environment['PLATFORM_WEBSITE_DOWNLOAD_URL'] = environment.PLATFORM_WEBSITE_DOWNLOAD_URL;

	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	dailyLogs: IReportDayData[] = [];
	loading: boolean;
	groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	ReportGroupFilterEnum = ReportGroupFilterEnum;

	/*
	* Getter & Setter for dynamic filters
	*/
	private _filters: ITimeLogFilters = this.request;
	get filters(): ITimeLogFilters {
		return this._filters;
	}
	@Input() set filters(filters: ITimeLogFilters) {
		if (filters) {
			this._filters = filters;
			this.subject$.next(true);
		}
	}

	constructor(
		private readonly timesheetService: TimesheetService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		public readonly translateService: TranslateService,
		private readonly cd: ChangeDetectorRef
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
				tap(() => this.getLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Change by group filter
	 */
	groupByChange() {
		this.subject$.next(true);
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		if (!this.organization || isEmpty(this.filters)) {
			return;
		}
		const appliedFilter = pick(
			this.filters,
			'source',
			'activityLevel',
			'logType'
		);
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			groupBy: this.groupBy
		};
		this.payloads$.next(request);
	}

	async getLogs() {
		if (!this.organization || isEmpty(this.request)) {
			return;
		}
		this.loading = true;
		try {
			const payloads = this.payloads$.getValue();
			this.dailyLogs = await this.timesheetService.getDailyReport(payloads);
		} catch (error) {
			console.log('Error while retrieving daily logs report', error);
		} finally {
			this.loading = false;
		}
	}

	public getStatus(value: number) {
		return progressStatus(value)
	}

	ngOnDestroy() { }
}
