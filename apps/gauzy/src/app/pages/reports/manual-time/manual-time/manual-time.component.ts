import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
	ID,
	IGetTimeLogReportInput,
	ITimeLog,
	ITimeLogFilters,
	ManualTimeLogAction,
	TimeFormatEnum,
	TimeLogType
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Observable, merge } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { isEmpty } from '@gauzy/ui-core/common';
import {
	BaseSelectorFilterComponent,
	buildReportExportFileName,
	GauzyFiltersComponent,
	ReportExportService,
	TimeZoneService
} from '@gauzy/ui-core/shared';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	IDatePickerConfig,
	Store,
	TimesheetFilterService,
	TimesheetService
} from '@gauzy/ui-core/core';
import {
	buildManualTimeExportTable,
	changedAtOf,
	EMPTY_MANUAL_TIME_SUMMARY,
	groupManualTimeLogsByDay,
	IManualTimeReportDay,
	IManualTimeReportSummary,
	isEditedLog,
	MANUAL_TIME_REPORT_EXPORT_NAME,
	MANUAL_TIME_REPORT_PAGE_SIZE,
	projectLinkOf,
	summarizeManualTimeLogs,
	taskLinkOf
} from './manual-time-report';
import { ManualTimeDetailsComponent } from '../manual-time-details/manual-time-details.component';

/** The relations each entry is read with: what the table and the details dialog show next to it. */
const MANUAL_TIME_RELATIONS = ['task', 'project', 'organizationContact', 'employee', 'employee.user', 'timesheet'];

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manual-time-report',
	templateUrl: './manual-time.component.html',
	styleUrls: ['./manual-time.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ManualTimeComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	/** Added / Edited: maps to the API's `isEdited`. Empty shows both. */
	public readonly actionControl = new FormControl<ManualTimeLogAction | null>(null);
	/** The task the entries were logged against: the API's `taskIds`. */
	public readonly taskControl = new FormControl<ID | null>(null);
	/** Only the entries marked billable: the API's `billableOnly`. */
	public readonly billableOnlyControl = new FormControl<boolean>(false, { nonNullable: true });
	/** With a team selected, also the time its members logged without a team: the API's `includeTimeWithoutTeam`. */
	public readonly includeTimeWithoutTeamControl = new FormControl<boolean>(false, { nonNullable: true });

	public readonly actions = [
		{ value: ManualTimeLogAction.ADDED, label: 'REPORT_PAGE.MANUAL_TIME.ADDED' },
		{ value: ManualTimeLogAction.EDITED, label: 'REPORT_PAGE.MANUAL_TIME.EDITED' }
	];
	public readonly ManualTimeLogAction = ManualTimeLogAction;

	filters: ITimeLogFilters;
	loading = false;
	loadingMore = false;
	/** Whether the last page came back full, so there may be more entries to load. */
	hasMore = false;

	/** Every entry loaded so far for the current filters, in the order the API returned them. */
	timeLogs: ITimeLog[] = [];
	dailyData: IManualTimeReportDay[] = [];
	summary: IManualTimeReportSummary = EMPTY_MANUAL_TIME_SUMMARY;

	/** The request the rows on screen answer, and the zone they are shown in. */
	private loadedRequest: IGetTimeLogReportInput | null = null;
	public loadedTimeZone: string;
	/** The last page read for the loaded request (1-based, as the API counts). */
	private page = 1;
	/** Bumped on every new request, so the answer to an older one is dropped instead of shown. */
	private generation = 0;
	/** The project and employee the task filter was chosen under: changing either clears it. */
	private taskScope: string | null = null;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<IDatePickerConfig | null> = this.dateRangePickerBuilderService.datePickerConfig$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _cd: ChangeDetectorRef,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _timesheetService: TimesheetService,
		private readonly _timesheetFilterService: TimesheetFilterService,
		private readonly _reportExportService: ReportExportService,
		private readonly _dialogService: NbDialogService,
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
	}

	ngAfterViewInit(): void {
		this._cd.detectChanges();
		merge(
			this.actionControl.valueChanges,
			this.taskControl.valueChanges,
			this.billableOnlyControl.valueChanges,
			this.includeTimeWithoutTeamControl.valueChanges
		)
			.pipe(
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The project selected in the header, which scopes the task filter. */
	get selectedProjectId(): ID | null {
		return this.request?.projectIds?.[0] ?? null;
	}

	/** The employee selected in the header, which scopes the task filter. */
	get selectedEmployeeId(): ID | null {
		return this.request?.employeeIds?.[0] ?? null;
	}

	/** `includeTimeWithoutTeam` only means something with a team: the toggle is offered then and only then. */
	get hasSelectedTeam(): boolean {
		return this.request?.teamIds?.length > 0;
	}

	/** The time format the timezone filter chose, for the time cells. */
	get timeFormat(): TimeFormatEnum | undefined {
		return this.filters?.timeFormat;
	}

	/** Whether any of this report's own filters is set (the header selectors aside). */
	get hasReportFilters(): boolean {
		return (
			!!this.actionControl.value ||
			!!this.taskControl.value ||
			this.billableOnlyControl.value ||
			(this.hasSelectedTeam && this.includeTimeWithoutTeamControl.value)
		);
	}

	/** The average duration of a loaded entry, in seconds. */
	get averagePerEntry(): number {
		return this.summary.entries ? Math.round(this.summary.duration / this.summary.entries) : 0;
	}

	/** The average manual time per employee among the loaded entries, in seconds. */
	get averagePerEmployee(): number {
		return this.summary.employees ? Math.round(this.summary.duration / this.summary.employees) : 0;
	}

	/**
	 * A count as a whole percentage of the loaded entries.
	 *
	 * @param count - Part of the entries, e.g. the edited ones.
	 */
	shareOf(count: number): number {
		return this.summary.entries ? Math.round((count / this.summary.entries) * 100) : 0;
	}

	/** There is something to export: the rows on screen answer the current filters. */
	get canExport(): boolean {
		return !this.loading && !this.loadingMore && this.timeLogs.length > 0 && !!this.loadedRequest;
	}

	/**
	 * Builds the request from the header selectors, the date range and this report's own filters, and loads its
	 * first page when it differs from the one on screen.
	 */
	prepareRequest(): void {
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// A task belongs to a project (and is listed for an employee): once either changes, the chosen task
		// may no longer be one of the choices, so it is cleared rather than silently filtering everything out.
		const scope = `${this.selectedProjectId ?? ''}|${this.selectedEmployeeId ?? ''}`;
		if (this.taskScope !== null && this.taskScope !== scope && this.taskControl.value) {
			this.taskControl.setValue(null, { emitEvent: false });
		}
		this.taskScope = scope;

		const action = this.actionControl.value;
		const taskId = this.taskControl.value;
		const request: IGetTimeLogReportInput = {
			...this.getFilterRequest(this.request),
			logType: [TimeLogType.MANUAL],
			...(action ? { isEdited: action === ManualTimeLogAction.EDITED } : {}),
			...(taskId ? { taskIds: [taskId] } : {}),
			...(this.billableOnlyControl.value ? { billableOnly: true } : {}),
			...(this.hasSelectedTeam && this.includeTimeWithoutTeamControl.value ? { includeTimeWithoutTeam: true } : {})
		};

		if (this.loadedRequest && JSON.stringify(request) === JSON.stringify(this.loadedRequest)) {
			return;
		}
		this.loadedRequest = request;
		this.getManualLogs();
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters): void {
		if (this.gauzyFiltersComponent?.saveFilters) {
			this._timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/** Clears this report's own filters; the header selectors and the date range are left as they are. */
	clearReportFilters(): void {
		this.actionControl.setValue(null, { emitEvent: false });
		this.taskControl.setValue(null, { emitEvent: false });
		this.billableOnlyControl.setValue(false, { emitEvent: false });
		this.includeTimeWithoutTeamControl.setValue(false, { emitEvent: false });
		this.subject$.next(true);
	}

	/**
	 * Loads the first page of manual entries for the current request, replacing what is on screen.
	 */
	async getManualLogs(): Promise<void> {
		if (!this.organization || !this.loadedRequest) {
			return;
		}
		const generation = ++this.generation;
		this.loading = true;
		this.loadingMore = false;
		this.timeLogs = [];
		this.page = 1;
		this.hasMore = false;
		this.applyLogs();

		try {
			const logs = await this.fetchPage(this.loadedRequest, 1);
			if (generation !== this.generation) {
				return;
			}
			this.timeLogs = logs;
			this.hasMore = logs.length === MANUAL_TIME_REPORT_PAGE_SIZE;
			this.applyLogs();
		} catch (error) {
			if (generation === this.generation) {
				this._errorHandlingService.handleError(error);
			}
		} finally {
			if (generation === this.generation) {
				this.loading = false;
				this._cd.markForCheck();
			}
		}
	}

	/**
	 * Loads the next page of the same request and adds it to what is on screen.
	 */
	async loadMore(): Promise<void> {
		if (!this.hasMore || this.loading || this.loadingMore || !this.loadedRequest) {
			return;
		}
		const generation = this.generation;
		const nextPage = this.page + 1;
		this.loadingMore = true;

		try {
			const logs = await this.fetchPage(this.loadedRequest, nextPage);
			if (generation !== this.generation) {
				return;
			}
			this.page = nextPage;
			this.timeLogs = [...this.timeLogs, ...logs];
			this.hasMore = logs.length === MANUAL_TIME_REPORT_PAGE_SIZE;
			this.applyLogs();
		} catch (error) {
			if (generation === this.generation) {
				this._errorHandlingService.handleError(error);
			}
		} finally {
			if (generation === this.generation) {
				this.loadingMore = false;
				this._cd.markForCheck();
			}
		}
	}

	/**
	 * Downloads the entries on screen as a CSV file named after the report and its date range.
	 */
	exportToCsv(): void {
		if (!this.canExport) {
			return;
		}
		const table = buildManualTimeExportTable(
			this.timeLogs,
			(key) => this.getTranslation(key),
			this.loadedTimeZone
		);
		this._reportExportService.export(table, {
			fileName: buildReportExportFileName(
				MANUAL_TIME_REPORT_EXPORT_NAME,
				this.request?.startDate,
				this.request?.endDate
			)
		});
	}

	/**
	 * Opens the details of an entry. When it is edited from there, the report reloads so the row, the day
	 * totals and the summary all show the saved entry.
	 *
	 * @param timeLog - The entry of the row.
	 */
	openDetails(timeLog: ITimeLog): void {
		this._dialogService
			.open(ManualTimeDetailsComponent, {
				context: { timeLog, timeZone: this.loadedTimeZone, timeFormat: this.timeFormat },
				autoFocus: true
			})
			.onClose.pipe(
				filter((saved: ITimeLog | null) => !!saved),
				tap(() => this.getManualLogs()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The page of the entry's project, for the Project cell. */
	projectLink(log: ITimeLog): string[] | null {
		return projectLinkOf(log);
	}

	/** The page of the entry's task, for the Task cell. */
	taskLink(log: ITimeLog): string[] | null {
		return taskLinkOf(log);
	}

	/** Whether an entry was edited after it was added. */
	isEdited(log: ITimeLog): boolean {
		return isEditedLog(log);
	}

	/** When the manual action on an entry took place. */
	changedAt(log: ITimeLog): Date | string | null {
		return changedAtOf(log);
	}

	/**
	 * Reads one page of manual entries.
	 *
	 * @param request - The report request.
	 * @param page - The 1-based page.
	 */
	private fetchPage(request: IGetTimeLogReportInput, page: number): Promise<ITimeLog[]> {
		return this._timesheetService.getTimeLogs(
			{ ...request, take: MANUAL_TIME_REPORT_PAGE_SIZE, skip: page } as IGetTimeLogReportInput,
			MANUAL_TIME_RELATIONS
		);
	}

	/** Regroups the loaded entries by day and recounts the summary, in the zone they were requested in. */
	private applyLogs(): void {
		this.loadedTimeZone = this.loadedRequest?.timeZone ?? this.timeZoneService.currentTimeZone;
		this.dailyData = groupManualTimeLogsByDay(this.timeLogs, this.loadedTimeZone);
		this.summary = summarizeManualTimeLogs(this.timeLogs);
	}
}
