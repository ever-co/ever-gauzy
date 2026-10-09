import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import * as moment from 'moment';
import { IManualTimesStatistics } from '@gauzy/contracts';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { ComponentsModule, DateFormatPipe, DurationFormatPipe } from '@gauzy/ui-core/shared';
import { Observable } from 'rxjs';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';

/**
 * List widget: time entries that were added by hand rather than tracked.
 *
 * Wraps the legacy dashboard's "Manual Time" window — same rows (member,
 * project, duration, date) and the same jump into the Manual Time Edits report.
 */
@Component({
	selector: 'gz-manual-time-widget',
	templateUrl: './manual-time-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss'],
	standalone: true,
	imports: [
		NbButtonModule,
		TranslateModule,
		ComponentsModule,
		DateFormatPipe,
		DurationFormatPipe,
		TimeTrackWidgetStateComponent
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManualTimeWidgetComponent extends BaseTimeTrackListWidgetComponent<IManualTimesStatistics> {
	private readonly _router = inject(Router);

	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_MANUAL_TIME';

	/**
	 * Reads the manual time entries for the current scope.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The manual time rows.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<IManualTimesStatistics[]> {
		return this.statisticsCache.getManualTimes(context);
	}

	/**
	 * Opens the Manual Time Edits report for the widget's own reporting window.
	 *
	 * The range comes from the widget context rather than the page selectors: a
	 * canvas widget may be pinned to a range the header no longer shows, and
	 * landing on a report for a different period would be a silent lie.
	 */
	protected openReport(): void {
		const context = this.widgetContext();
		if (!context) {
			return;
		}

		this._router.navigate(['/pages/reports/manual-time-edits'], {
			queryParams: {
				date: moment(context.startDate).format('MM-DD-YYYY'),
				date_end: moment(context.endDate).format('MM-DD-YYYY')
			}
		});
	}
}
