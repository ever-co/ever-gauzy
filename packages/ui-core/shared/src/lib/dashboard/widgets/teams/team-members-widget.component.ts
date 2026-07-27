import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NbComponentStatus, NbBadgeModule, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { ComponentsModule } from '../../../components/components.module';
import { DurationFormatPipe } from '../../../pipes/duration-format.pipe';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardMember } from './teams-dashboard.types';
import { toPercentage } from './teams-widget.utils';

/**
 * Flat list of every team member in scope: status dot, avatar, how much of the
 * working day they logged, and their activity percentage.
 *
 * Extracted from `gauzy-team-member` in its "classic" mode — the compact row the
 * legacy Teams dashboard renders inside each team card. Working members come
 * first, matching the legacy order, and a person on two teams appears once per
 * team (their numbers differ per team, because time is logged against a team).
 */
@Component({
	selector: 'ga-team-members-widget',
	templateUrl: './team-members-widget.component.html',
	styleUrls: ['./team-members-widget.component.scss'],
	standalone: true,
	imports: [
		NbBadgeModule,
		NbProgressBarModule,
		TranslateModule,
		ComponentsModule,
		DurationFormatPipe,
		TeamsWidgetStateComponent
	],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamMembersWidgetComponent extends BaseTeamsWidgetComponent {
	/** Every member row across the teams in scope, working members first. */
	protected readonly members = computed<ITeamDashboardMember[]>(() =>
		(this.snapshot()?.teams ?? []).flatMap((team) => team.members)
	);

	/** True when more than one team is in scope, which is when the row needs its team name. */
	protected readonly showTeamName = computed<boolean>(() => (this.snapshot()?.teams ?? []).length > 1);

	/**
	 * Share of the member's working day that is already logged.
	 *
	 * @param member - The row being rendered.
	 * @returns A percentage between 0 and 100.
	 */
	protected workedPercentage(member: ITeamDashboardMember): number {
		return toPercentage(member.workedDuration, member.workPeriod);
	}

	/**
	 * Nebular status for a percentage, so the progress bars and activity badges
	 * use the same danger/warning/info/success scale as the rest of the app.
	 *
	 * @param value - A percentage between 0 and 100.
	 * @returns The matching Nebular status name.
	 */
	protected statusFor(value: number): NbComponentStatus {
		return progressStatus(value ?? 0);
	}

	/**
	 * Rounded activity percentage rendered inside the member's badge.
	 *
	 * Formatted here rather than through the decimal pipe so the widget does not
	 * have to pull `CommonModule` in just for one number.
	 *
	 * @param member - The row being rendered.
	 * @returns The percentage, e.g. `"64%"`.
	 */
	protected activityLabel(member: ITeamDashboardMember): string {
		return `${Math.round(member.activity ?? 0)}%`;
	}
}
