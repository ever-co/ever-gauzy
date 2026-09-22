import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamSummaryCardComponent } from './team-summary-card.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardTeam } from './teams-dashboard.types';

/**
 * Grid of one card per team: working members over total members, plus the
 * working-now / working-today / not-working legend.
 *
 * Extracted from the masonry section of the legacy Teams dashboard (which merges
 * `gauzy-team-card` and the per-team header of `gauzy-all-team`). The member
 * rows those cards nest are widgets of their own — see `TeamMembersWidgetComponent`
 * for the flat list and `TeamOverviewWidgetComponent` for the nested masonry — so
 * this one stays readable at three columns.
 */
@Component({
	selector: 'ga-team-cards-widget',
	templateUrl: './team-cards-widget.component.html',
	styleUrls: ['./team-cards-widget.component.scss'],
	standalone: true,
	imports: [TeamSummaryCardComponent, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamCardsWidgetComponent extends BaseTeamsWidgetComponent {
	/** Teams in scope, in the order the API returned them. */
	protected readonly teams = computed<ITeamDashboardTeam[]>(() => this.snapshot()?.teams ?? []);
}
