import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsCounterCardComponent } from './teams-counter-card.component';

/**
 * Counter widget: overall activity percentage of the teams in the selected range.
 *
 * Extracted from the fourth card of the legacy Teams dashboard
 * ("Worked for the day"), which renders `counts.weekActivities` as a progress bar.
 * The counts request is scoped to the teams' members, so the number answers "how
 * active were these teams", not "how active was the whole organization".
 */
@Component({
	selector: 'ga-teams-activity-widget',
	templateUrl: './teams-activity-widget.component.html',
	standalone: true,
	imports: [TeamsCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsActivityWidgetComponent extends BaseTeamsWidgetComponent {
	/** Activity percentage, clamped to the 0..100 the progress bar can render. */
	protected readonly activity = computed<number>(() => {
		const value = this.snapshot()?.activityPercentage ?? 0;
		return Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
	});

	/** Rounded value shown as the headline figure. */
	protected readonly activityLabel = computed<string>(() => Math.round(this.activity()).toString());
}
