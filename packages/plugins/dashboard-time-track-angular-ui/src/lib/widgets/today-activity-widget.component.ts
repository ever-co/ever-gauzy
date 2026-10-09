import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';

/**
 * Counter widget: today's overall activity percentage (keyboard/mouse activity
 * recorded by the desktop tracker), rendered as a progress bar.
 */
@Component({
	selector: 'gz-today-activity-widget',
	templateUrl: './today-activity-widget.component.html',
	standalone: true,
	imports: [TimeTrackCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayActivityWidgetComponent extends BaseTimeTrackCounterWidgetComponent {
	/** Today's activity percentage. */
	protected readonly todayActivity = computed<number>(() => this.counts()?.todayActivities ?? 0);
}
