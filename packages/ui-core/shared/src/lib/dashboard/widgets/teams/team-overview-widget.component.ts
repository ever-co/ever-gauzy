import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamMemberRowComponent } from './team-member-row.component';
import { TeamSummaryCardComponent } from './team-summary-card.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardTeam } from './teams-dashboard.types';

/**
 * The full per-team overview: one card per team, each showing the team's
 * headline numbers AND the members behind them.
 *
 * This is the masonry section of the legacy Teams dashboard (`gauzy-all-team`),
 * the view a user lands on before drilling into a single team. It is the
 * composition of the two narrower Teams widgets — `ga-team-summary-card` for the
 * heading and `ga-team-member-row` for the people — reused verbatim rather than
 * re-implemented, so all three widgets stay visually identical.
 *
 * The legacy card also carried a "drill into this team" arrow. It is deliberately
 * absent: on a canvas there is no second view to drill INTO, and the drill-down
 * the button opened is what the Team Member Details widget renders directly.
 */
@Component({
	selector: 'ga-team-overview-widget',
	templateUrl: './team-overview-widget.component.html',
	styleUrls: ['./team-overview-widget.component.scss'],
	standalone: true,
	imports: [TranslateModule, TeamMemberRowComponent, TeamSummaryCardComponent, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamOverviewWidgetComponent extends BaseTeamsWidgetComponent {
	/**
	 * Teams in scope, in the order the API returned them.
	 *
	 * Their `members` are already ordered working-first by the snapshot service,
	 * which is the order the legacy card rendered
	 * (`membersWorkingToday.concat(membersNotWorkingToday)`).
	 */
	protected readonly teams = computed<ITeamDashboardTeam[]>(() => this.snapshot()?.teams ?? []);
}
