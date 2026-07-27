import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NbBadgeModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CounterPointComponent } from '../../../counter-point/counter-point.component';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardTeam } from './teams-dashboard.types';

/**
 * Grid of one card per team: working members over total members, plus the
 * working-now / working-today / not-working legend.
 *
 * Extracted from the masonry section of the legacy Teams dashboard (which merges
 * `gauzy-team-card` and the per-team header of `gauzy-all-team`). The member
 * rows those cards nest are a widget of their own — see
 * `TeamMembersWidgetComponent` — so this one stays readable at three columns.
 */
@Component({
	selector: 'ga-team-cards-widget',
	templateUrl: './team-cards-widget.component.html',
	styleUrls: ['./team-cards-widget.component.scss'],
	standalone: true,
	imports: [NbBadgeModule, TranslateModule, CounterPointComponent, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamCardsWidgetComponent extends BaseTeamsWidgetComponent {
	/** Teams in scope, in the order the API returned them. */
	protected readonly teams = computed<ITeamDashboardTeam[]>(() => this.snapshot()?.teams ?? []);

	/**
	 * Members that logged time but have no timer running right now.
	 *
	 * Kept out of the template because the subtraction can go negative for a
	 * fraction of a second while a snapshot is being replaced, and a "-1" badge
	 * is worse than a "0" one.
	 *
	 * @param team - The team whose badge is being rendered.
	 * @returns The number of members working today but currently idle.
	 */
	protected workingToday(team: ITeamDashboardTeam): number {
		return Math.max(team.countWorking - team.countOnline, 0);
	}
}
