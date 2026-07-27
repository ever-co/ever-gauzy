import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NbButtonModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import * as moment from 'moment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IActivitiesStatistics } from '@gauzy/contracts';
import { IDashboardWidgetContext, withDurationPercentage } from '@gauzy/ui-core/core';
import { ActivityItemModule } from '@gauzy/ui-core/shared';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';

/**
 * List widget: which applications and URLs the tracked time was spent in.
 *
 * Wraps the legacy dashboard's "Apps & URLs" window, and reuses the very same
 * row component (`ngx-activity-item` in its `isDashboard` mode) rather than
 * re-implementing the title / share / duration layout.
 */
@Component({
	selector: 'gz-apps-urls-widget',
	templateUrl: './apps-urls-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss'],
	standalone: true,
	imports: [NbButtonModule, TranslateModule, ActivityItemModule, TimeTrackWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppsUrlsWidgetComponent extends BaseTimeTrackListWidgetComponent<IActivitiesStatistics> {
	private readonly _router = inject(Router);

	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_APP_URL_ACTIVITY';

	/**
	 * Reads the app / URL activity buckets for the current scope.
	 *
	 * The endpoint returns raw durations, so the relative share every row renders
	 * is derived with the shared {@link withDurationPercentage} helper — the same
	 * denominator (the total of the returned page) the legacy dashboard used.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The activity rows with `durationPercentage` populated.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<IActivitiesStatistics[]> {
		return this.statisticsCache
			.getActivities(context)
			.pipe(map((activities: IActivitiesStatistics[]) => withDurationPercentage(activities)));
	}

	/**
	 * Opens the Apps & URLs report for the widget's own reporting window.
	 *
	 * The range comes from the widget context rather than the page selectors: a
	 * canvas widget may be pinned to a range the header no longer shows.
	 */
	protected openReport(): void {
		const context = this.widgetContext();
		if (!context) {
			return;
		}

		this._router.navigate(['/pages/reports/apps-urls'], {
			queryParams: {
				date: moment(context.startDate).format('MM-DD-YYYY'),
				date_end: moment(context.endDate).format('MM-DD-YYYY')
			}
		});
	}
}
