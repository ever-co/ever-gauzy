import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { DurationFormatPipe } from '@gauzy/ui-core/shared';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';
import { RangePeriod } from './time-track-widget.utils';

/**
 * Counter widget: total duration worked over the selected period.
 *
 * The host header always reads "Worked This Week" (the registry title), so the
 * widget adds a caption whenever the selected range is something else — the
 * legacy dashboard conveyed the same thing by rewriting its card title, which a
 * canvas widget cannot do.
 */
@Component({
	selector: 'gz-worked-this-week-widget',
	templateUrl: './worked-this-week-widget.component.html',
	standalone: true,
	imports: [DurationFormatPipe, TimeTrackCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkedThisWeekWidgetComponent extends BaseTimeTrackCounterWidgetComponent {
	/** Seconds worked over the selected range. */
	protected readonly weekDuration = computed<number>(() => this.counts()?.weekDuration ?? 0);

	/** Range-aware caption; `null` when the host title already says it. */
	protected readonly captionKey = computed<string | null>(() => {
		switch (this.rangePeriod()) {
			case RangePeriod.PERIOD:
				return 'TIMESHEET.WORKED_OVER_PERIOD';
			case RangePeriod.DAY:
				return 'TIMESHEET.WORKED_FOR_DAY';
			default:
				return this.isCurrentWeek() ? null : 'TIMESHEET.WORKED_FOR_WEEK';
		}
	});
}
