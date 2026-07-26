import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { DurationFormatPipe } from '@gauzy/ui-core/shared';
import { BaseTimeTrackCounterWidgetComponent } from './base-time-track-counter-widget.component';
import { TimeTrackCounterCardComponent } from './time-track-counter-card.component';

/**
 * Counter widget: total duration worked today across the current scope,
 * rendered as `HH:mm:ss` against the range's workable capacity.
 */
@Component({
	selector: 'gz-worked-today-widget',
	templateUrl: './worked-today-widget.component.html',
	standalone: true,
	imports: [DurationFormatPipe, TimeTrackCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkedTodayWidgetComponent extends BaseTimeTrackCounterWidgetComponent {
	/** Seconds worked today. */
	protected readonly todayDuration = computed<number>(() => this.counts()?.todayDuration ?? 0);
}
