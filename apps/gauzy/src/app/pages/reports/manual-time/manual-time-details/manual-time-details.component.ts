import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, Input, OnInit } from '@angular/core';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs/operators';
import { ITimeLog, PermissionsEnum, TimeFormatEnum, TimesheetStatus } from '@gauzy/contracts';
import { TimesheetService } from '@gauzy/ui-core/core';
import { EditTimeLogModalComponent } from '@gauzy/ui-core/shared';
import {
	changedAtOf,
	employeeNameOf,
	isEditedLog,
	projectLinkOf,
	taskLinkOf
} from '../manual-time/manual-time-report';
import {
	buildManualTimeDay,
	dayRangeOf,
	IManualTimeDay,
	IManualTimeDaySegment,
	percentOf,
	TIMELINE_HOURS
} from './manual-time-day';

/**
 * The details of one manual time entry, opened from a row of the Manual Time Edits report.
 *
 * The entry itself is what the report already loaded for the row, read in the report's time zone, so the
 * dialog never disagrees with the line it was opened from. Around it, the employee's whole day is read once
 * for the charts: where this entry falls among the rest of their time, and how much of the day was added by
 * hand. Closes with the saved log when the entry was edited from here, so the report can reload; with `null`
 * otherwise.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manual-time-details',
	templateUrl: './manual-time-details.component.html',
	styleUrls: ['./manual-time-details.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ManualTimeDetailsComponent implements OnInit {
	private readonly _dialogRef = inject<NbDialogRef<ManualTimeDetailsComponent>>(NbDialogRef);
	private readonly _dialogService = inject(NbDialogService);
	private readonly _timesheetService = inject(TimesheetService);
	private readonly _cd = inject(ChangeDetectorRef);

	/** The entry, as the report row holds it. */
	@Input() timeLog: ITimeLog;
	/** The IANA zone the report is read in. */
	@Input() timeZone: string;
	/** The time format the report's filters chose. */
	@Input() timeFormat: TimeFormatEnum | undefined;

	public readonly PermissionsEnum = PermissionsEnum;
	public readonly ticks = TIMELINE_HOURS;

	/** The employee's day around the entry; the entry alone until the rest is read. */
	public day: IManualTimeDay | null = null;
	public dayLoading = false;
	/** The rest of the day could not be read: the charts show the entry alone and say so. */
	public dayFailed = false;

	ngOnInit(): void {
		if (!this.timeLog) {
			return;
		}
		this.day = buildManualTimeDay(this.timeLog, null, this.timeZone, this.timeFormat);
		this.loadDay();
	}

	get isEdited(): boolean {
		return isEditedLog(this.timeLog);
	}

	get changedAt(): Date | string | null {
		return changedAtOf(this.timeLog);
	}

	/**
	 * The entry's timesheet is approved: its hours are final, so it cannot be edited from here, as on the
	 * timesheet page.
	 */
	get isApproved(): boolean {
		return this.timeLog?.timesheet?.status === TimesheetStatus.APPROVED;
	}

	/** Where an hour mark sits on the timeline: the day's own clock, so a 23- or 25-hour day lines up. */
	tickPosition(index: number, hour: number): number {
		return this.day?.hourPositions?.[index] ?? (hour / 24) * 100;
	}

	get employeeName(): string {
		return employeeNameOf(this.timeLog?.employee);
	}

	/** The project's own page; `null` when the entry has no project. */
	get projectLink(): string[] | null {
		return projectLinkOf(this.timeLog);
	}

	/** The task's own page; `null` when the entry has no task. */
	get taskLink(): string[] | null {
		return taskLinkOf(this.timeLog);
	}

	/** Share of the day that was tracked, as a whole percentage. */
	get trackedShare(): number {
		return percentOf(this.day?.tracked ?? 0, this.day?.total ?? 0);
	}

	/** Share of the day that was added by hand (this entry included), as a whole percentage. */
	get manualShare(): number {
		return this.day?.total ? 100 - this.trackedShare : 0;
	}

	/** Share of the day this entry alone accounts for. */
	get currentShare(): number {
		return percentOf(this.day?.current ?? 0, this.day?.total ?? 0);
	}

	/** The day's manual time other than this entry, in seconds. */
	get otherManual(): number {
		return Math.max(0, (this.day?.manual ?? 0) - (this.day?.current ?? 0));
	}

	/** Width of a bar segment, as a percentage of the day's total. */
	widthOf(seconds: number): number {
		return this.day?.total ? (seconds / this.day.total) * 100 : 0;
	}

	trackSegment(_: number, segment: IManualTimeDaySegment): string {
		return segment.id;
	}

	/**
	 * Opens the shared time log editor on this entry. Cancelling it comes back here; saving closes this dialog
	 * too, handing the saved log to the report so it reloads.
	 */
	edit(): void {
		if (!this.timeLog || this.timeLog.isRunning || this.isApproved) {
			return;
		}
		this._dialogService
			.open(EditTimeLogModalComponent, { context: { timeLog: this.timeLog } })
			.onClose.pipe(
				filter((saved: ITimeLog) => !!saved),
				tap((saved: ITimeLog) => this._dialogRef.close(saved)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	close(): void {
		this._dialogRef.close(null);
	}

	/**
	 * Reads every time log the employee has on the entry's day, tracked and manual, for the charts.
	 */
	private async loadDay(): Promise<void> {
		const { organizationId, tenantId, employeeId } = this.timeLog;
		if (!organizationId || !employeeId) {
			return;
		}
		const { startDate, endDate } = dayRangeOf(this.timeLog, this.timeZone);
		this.dayLoading = true;
		try {
			const logs = await this._timesheetService.getTimeLogs({
				organizationId,
				tenantId,
				employeeIds: [employeeId],
				startDate,
				endDate,
				timeZone: this.timeZone
			});
			this.day = buildManualTimeDay(this.timeLog, logs, this.timeZone, this.timeFormat);
			this.dayFailed = false;
		} catch {
			this.dayFailed = true;
		} finally {
			this.dayLoading = false;
			this._cd.markForCheck();
		}
	}
}
