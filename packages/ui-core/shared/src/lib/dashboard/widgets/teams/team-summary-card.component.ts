import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NbBadgeModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { CounterPointComponent } from '../../../counter-point/counter-point.component';
import { ITeamDashboardTeam } from './teams-dashboard.types';

/**
 * Headline of one team: working members over total, the team's name, and the
 * working-now / working-today / not-working legend.
 *
 * Extracted from the masonry card header of the legacy Teams dashboard (which
 * merges `gauzy-team-card` and the per-team header of `gauzy-all-team`) and
 * shared by the Team Cards grid and the per-team overview, so the two cannot
 * disagree about what a team's numbers look like.
 *
 * Purely presentational: it fetches nothing and owns no state.
 */
@Component({
	selector: 'ga-team-summary-card',
	templateUrl: './team-summary-card.component.html',
	styleUrls: ['./team-summary-card.component.scss'],
	standalone: true,
	imports: [NbBadgeModule, TranslateModule, CounterPointComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamSummaryCardComponent {
	/** The team to summarize. */
	readonly team = input.required<ITeamDashboardTeam>();

	/**
	 * Whether to draw the counter-point strip under the legend.
	 *
	 * The overview widget hides it: there the strip sits directly above the team's
	 * own member rows, which already convey the same working/idle split.
	 */
	readonly showCounter = input<boolean>(true);

	/**
	 * Members that logged time but have no timer running right now.
	 *
	 * Computed rather than subtracted in the template because the difference can
	 * go negative for a fraction of a second while a snapshot is being replaced,
	 * and a "-1" badge is worse than a "0" one.
	 */
	protected readonly workingToday = computed<number>(() =>
		Math.max(this.team().countWorking - this.team().countOnline, 0)
	);
}
