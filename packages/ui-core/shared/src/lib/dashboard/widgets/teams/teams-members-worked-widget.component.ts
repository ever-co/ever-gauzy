import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsCounterCardComponent } from './teams-counter-card.component';

/**
 * Counter widget: how many team members logged time in the selected range.
 *
 * Extracted from the second card of the legacy Teams dashboard. Unlike the Time
 * Tracking "Members worked" counter this one is scoped to TEAM MEMBERSHIP: its
 * denominator is the number of people on the teams in scope, not the
 * organization's head count, and somebody on two teams still counts once.
 */
@Component({
	selector: 'ga-teams-members-worked-widget',
	templateUrl: './teams-members-worked-widget.component.html',
	standalone: true,
	imports: [TeamsCounterCardComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamsMembersWorkedWidgetComponent extends BaseTeamsWidgetComponent {
	/** Distinct members that logged time in the range. */
	protected readonly membersWorked = computed<number>(() => this.snapshot()?.membersWorked ?? 0);

	/** Distinct members across the teams in scope — the counter-point denominator. */
	protected readonly membersTotal = computed<number>(() => this.snapshot()?.membersTotal ?? 0);
}
