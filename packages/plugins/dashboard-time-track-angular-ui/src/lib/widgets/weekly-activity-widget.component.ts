import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';
import { RangePeriod } from './time-track-widget.utils';

/**
 * Counter widget: overall activity percentage for the selected period,
 * rendered as a progress bar.
 *
 * Like its duration sibling, it captions the number with the selected range so a
 * month-long selection does not silently read as "Weekly Activity".
 */
@Component({
	selector: 'gz-weekly-activity-widget',
	templateUrl: './weekly-activity-widget.component.html',
	standalone: true,
	imports: [TimeTrackCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyActivityWidgetComponent extends BaseTimeTrackCounterWidgetComponent {
	/** Activity percentage over the selected range. */
	protected readonly weekActivity = computed<number>(() => this.counts()?.weekActivities ?? 0);

	/** Range-aware caption; `null` when the host title already says it. */
	protected readonly captionKey = computed<string | null>(() => {
		switch (this.rangePeriod()) {
			case RangePeriod.PERIOD:
				return 'TIMESHEET.ACTIVITY_OVER_PERIOD';
			case RangePeriod.DAY:
				return 'TIMESHEET.ACTIVITY_FOR_DAY';
			default:
				// The host header already reads "Weekly Activity".
				return null;
		}
	});
}
