import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamMemberRowComponent } from './team-member-row.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardMember } from './teams-dashboard.types';

/**
 * Flat list of every team member in scope: status dot, avatar, how much of the
 * working day they logged, and their activity percentage.
 *
 * Extracted from `gauzy-team-member` in its "classic" mode — the compact row the
 * legacy Teams dashboard renders inside each team card. Working members come
 * first, matching the legacy order, and a person on two teams appears once per
 * team (their numbers differ per team, because time is logged against a team).
 *
 * The row itself is `ga-team-member-row`, shared with the per-team overview
 * widget; this component only decides WHICH rows to show and in what order.
 */
@Component({
	selector: 'ga-team-members-widget',
	templateUrl: './team-members-widget.component.html',
	styleUrls: ['./team-members-widget.component.scss'],
	standalone: true,
	imports: [TeamMemberRowComponent, TeamsWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamMembersWidgetComponent extends BaseTeamsWidgetComponent {
	/** Every member row across the teams in scope, working members first. */
	protected readonly members = computed<ITeamDashboardMember[]>(() =>
		(this.snapshot()?.teams ?? []).flatMap((team) => team.members)
	);

	/** True when more than one team is in scope, which is when the row needs its team name. */
	protected readonly showTeamName = computed<boolean>(() => (this.snapshot()?.teams ?? []).length > 1);
}
