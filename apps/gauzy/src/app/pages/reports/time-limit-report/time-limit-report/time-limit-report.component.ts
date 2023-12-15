import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { distinctUntilChange, isEmpty } from '@gauzy/common-angular';
import {
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	ITimeLogFilters
} from '@gauzy/contracts';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-limit-report',
	templateUrl: './time-limit-report.component.html',
	styleUrls: ['./time-limit-report.component.scss']
})
export class TimeLimitReportComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	loading: boolean = false;
	dailyData: any;
	title: string;
	duration: 'day' | 'week' | 'month';

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly cd: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		private readonly activatedRoute: ActivatedRoute,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit(): void {
		this.activatedRoute.data
			.pipe(
				tap((data) => {
					this.duration = data.duration || 'day';
					this.title = data.title;
				}),
				untilDestroyed(this)
			).subscribe();
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
				tap(() => this.getTimeLimitReport()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cd.detectChanges();
	}

	/**
	 * Get header selectors request and Gauzy timesheet filters request.
	 */
	prepareRequest(): void {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Determine the current timezone using moment-timezone
		const timezone: string = moment.tz.guess();

		// Create a request object of type IGetTimeLimitReportInput
		const request: IGetTimeLimitReportInput = {
			...this.getFilterRequest(this.request),
			duration: this.duration,
			// Set the 'timezone' property to the determined timezone
			timezone
		};

		// Notify subscribers about the filter change
		this.payloads$.next(request);
	}


	/**
	 * Updates Gauzy timesheet default filters, saves the filters if configured to do so,
	 * and notifies subscribers about the change.
	 *
	 * @param filters - An object representing time log filters (ITimeLogFilters).
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Save filters to the timesheetFilterService if configured to do so
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}

		// Create a shallow copy of the filters and update the class property
		this.filters = { ...filters };

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}


	/**
	 * Retrieves time limit reports, updates the 'dailyData' property, and handles loading state.
	 *
	 * @returns
	 */
	async getTimeLimitReport(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set the loading flag to true
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the time limit report data from the timesheetService
			const limits: ITimeLimitReport[] = await this.timesheetService.getTimeLimit(payloads);

			// Update the 'dailyData' property with the retrieved data
			this.dailyData = limits;
		} catch (error) {
			// Log any errors during the process
			console.error(`Error while retrieving ${this.title} time limit report`, error);
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}
}
