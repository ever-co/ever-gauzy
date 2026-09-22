import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsCounterCardComponent } from './teams-counter-card.component';

/**
 * Counter widget: how many projects the teams logged time against.
 *
 * Extracted from the third card of the legacy Teams dashboard. The numerator is
 * derived from the teams' own time logs (so it follows the team/employee scope),
 * while the denominator is the organization's total project count.
 */
@Component({
	selector: 'ga-teams-projects-worked-widget',
	templateUrl: './teams-projects-worked-widget.component.html',
	standalone: true,
	imports: [TeamsCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsProjectsWorkedWidgetComponent extends BaseTeamsWidgetComponent {
	/** Distinct projects that received logged time in the range. */
	protected readonly projectsWorked = computed<number>(() => this.snapshot()?.projectsWorked ?? 0);

	/** Projects in the organization — the counter-point denominator. */
	protected readonly projectsTotal = computed<number>(() => this.snapshot()?.projectsTotal ?? 0);
}
