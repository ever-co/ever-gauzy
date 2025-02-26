import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { IGetTimeLogReportInput, ITimeLog, ITimeLogFilters, TimeLogType, ManualTimeLogAction } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { chain } from 'underscore';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { BaseSelectorFilterComponent, GauzyFiltersComponent, TimeZoneService } from '@gauzy/ui-core/shared';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	Store,
	TimesheetFilterService,
	TimesheetService
} from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-manual-time-report',
    templateUrl: './manual-time.component.html',
    styleUrls: ['./manual-time.component.scss'],
    standalone: false
})
export class ManualTimeComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public control = new FormControl();

	filters: ITimeLogFilters;
	loading: boolean;
	dailyData: any;
	ManualTimeLogAction: typeof ManualTimeLogAction = ManualTimeLogAction;
	actions: string[] = Object.values(ManualTimeLogAction);

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		public readonly translateService: TranslateService,
		private readonly _cd: ChangeDetectorRef,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _timesheetService: TimesheetService,
		private readonly _timesheetFilterService: TimesheetFilterService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit(): void {
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
				tap(() => this.getManualLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 *
	 */
	ngAfterViewInit() {
		this._cd.detectChanges();
		this.control.valueChanges
			.pipe(
				distinctUntilChanged(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Prepares the time log report request.
	 * @returns {void}
	 */
	prepareRequest(): void {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			logType: [TimeLogType.MANUAL]
		};
		if (this.control.getRawValue()) {
			request['isEdited'] = this.control.getRawValue() === ManualTimeLogAction.EDITED;
		}
		this.payloads$.next(request);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this._timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Asynchronously fetch manual time logs and update the component's state.
	 * Handles loading state, API request, data processing, and errors.
	 *
	 * @returns {Promise<void>} A promise resolving to an array of objects containing date and timeLogs.
	 */
	async getManualLogs(): Promise<void> {
		// Check if organization and request data are available
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous data and set loading state to true
		this.dailyData = [];
		this.loading = true;

		try {
			// Get the payloads from the observable
			const payloads = this.payloads$.getValue();

			// Call the timesheetService to fetch time logs
			const logs: ITimeLog[] = await this._timesheetService.getTimeLogs(payloads, [
				'task',
				'project',
				'employee',
				'employee.user'
			]);

			// Check if logs are empty and handle gracefully
			if (logs.length === 0) {
				console.log('No manual logs found for the given request.');
				return;
			}

			// Process the fetched logs and update the component's state
			this.dailyData = chain(logs)
				.groupBy((log: ITimeLog) => moment(log.startedAt).format('YYYY-MM-DD'))
				.map((timeLogs, date) => ({ date, timeLogs }))
				.value();
		} catch (error) {
			// Handle any exceptions or errors during the fetch
			console.error('Error fetching manual logs:', error);
			this._errorHandlingService.handleError(error);
		} finally {
			// Set loading state to false regardless of success or failure
			this.loading = false;
		}
	}
}
