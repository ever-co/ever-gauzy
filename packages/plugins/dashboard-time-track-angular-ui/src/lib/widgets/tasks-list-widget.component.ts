import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NbButtonModule, NbComponentStatus, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { ITasksStatistics } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/ui-core/common';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { DurationFormatPipe } from '@gauzy/ui-core/shared';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';

/**
 * List widget: the tasks that absorbed the most time in the selected range.
 *
 * Wraps the legacy dashboard's "Tasks" window: same top-N rows (title, share of
 * the range, duration) and the same jump into the Tasks dashboard.
 */
@Component({
	selector: 'gz-tasks-list-widget',
	templateUrl: './tasks-list-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss'],
	standalone: true,
	imports: [NbButtonModule, NbProgressBarModule, TranslateModule, DurationFormatPipe, TimeTrackWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksListWidgetComponent extends BaseTimeTrackListWidgetComponent<ITasksStatistics> {
	private readonly _router = inject(Router);

	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_TASK_ACTIVITY';

	/**
	 * Reads the task statistics for the current scope.
	 *
	 * The page size is left at the cache service's default (5, the number the
	 * legacy dashboard requests) on purpose: `take` is part of the cache key, so
	 * asking for a different one here would open a second, non-shared entry for
	 * the very same scope.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The task rows, highest duration first.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<ITasksStatistics[]> {
		return this.statisticsCache.getTasks(context);
	}

	/**
	 * Rounded share of the range's tracked time that went into a task.
	 *
	 * Rounded here rather than through the decimal pipe so the widget does not
	 * pull `CommonModule` in for one number.
	 *
	 * @param task - The row being rendered.
	 * @returns A percentage between 0 and 100.
	 */
	protected sharePercentage(task: ITasksStatistics): number {
		return Math.round(task?.durationPercentage ?? 0);
	}

	/**
	 * Nebular status for a percentage, so the bars use the same
	 * danger/warning/info/success scale as the rest of the app.
	 *
	 * @param value - A percentage between 0 and 100.
	 * @returns The matching Nebular status name.
	 */
	protected statusFor(value: number): NbComponentStatus {
		return progressStatus(value ?? 0);
	}

	/** Opens the Tasks dashboard, matching the legacy panel's "View all". */
	protected openTasks(): void {
		this._router.navigate(['/pages/tasks/dashboard']);
	}
}
