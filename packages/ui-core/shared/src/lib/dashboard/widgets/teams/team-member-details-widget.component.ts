import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { NbBadgeModule, NbComponentStatus, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { ComponentsModule } from '../../../components/components.module';
import { DurationFormatPipe } from '../../../pipes/duration-format.pipe';
import { BaseTeamsWidgetComponent } from './base-teams-widget.component';
import { TeamsWidgetStateComponent } from './teams-widget-state.component';
import { ITeamDashboardMember, ITeamDashboardMemberTask, NO_TASK_ID } from './teams-dashboard.types';
import { toPercentage } from './teams-widget.utils';

/**
 * The drill-down table of the legacy Teams dashboard: every member with the
 * tasks they logged time against, each task's duration measured against its
 * estimate, and the member's activity percentage.
 *
 * On the legacy page this only appeared after clicking into a single team
 * (`gauzy-team-member` in its NON-classic mode, behind the team card's arrow
 * button). A canvas has no such navigation, so the widget renders every team in
 * scope at once and labels each member with their team; pinning it to one team
 * is what the placement's team scope is for.
 *
 * The compact widgets read the same snapshot — this one is the only consumer of
 * its `tasks`, which `TeamsDashboardStatisticsService` derives with the legacy
 * page's own `_groupBy('taskId')` pass.
 */
@Component({
	selector: 'ga-team-member-details-widget',
	templateUrl: './team-member-details-widget.component.html',
	styleUrls: ['./team-member-details-widget.component.scss'],
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
export class TeamMemberDetailsWidgetComponent extends BaseTeamsWidgetComponent {
	/**
	 * Every member row across the teams in scope, GROUPED BY TEAM.
	 *
	 * The grouping is the point, not an accident of `flatMap`: the legacy page
	 * rendered one team at a time (`TeamComponent.members` concatenates the
	 * selected team's `membersWorkingToday` with its `membersNotWorkingToday`), so
	 * rendering several teams at once has to keep each team's block contiguous —
	 * the rows carry a team name column exactly when there is more than one.
	 * `TeamsDashboardStatisticsService` already emits `team.members` as
	 * working-then-idle, which reproduces the legacy order INSIDE each block.
	 *
	 * Sorting the flattened list by working-state instead would interleave teams
	 * and make the team column jump, which no view of this data ever did.
	 */
	protected readonly members = computed<ITeamDashboardMember[]>(() =>
		(this.snapshot()?.teams ?? []).flatMap((team) => team.members)
	);

	/** True when more than one team is in scope, which is when a row needs its team name. */
	protected readonly showTeamName = computed<boolean>(() => (this.snapshot()?.teams ?? []).length > 1);

	/**
	 * Whether a task row is the "time logged without a task" bucket.
	 *
	 * @param task - The task row being rendered.
	 * @returns True when the row should be labelled rather than named.
	 */
	protected isWithoutTask(task: ITeamDashboardMemberTask): boolean {
		return task.id === NO_TASK_ID || !task.title;
	}

	/**
	 * How far a task's logged time has eaten into its estimate.
	 *
	 * A task without an estimate yields 0 — the legacy page's `calculatePercentage`
	 * divided by `undefined` and rendered the resulting `NaN` as an empty bar,
	 * which is the same thing with a lot more console noise.
	 *
	 * @param task - The task row being rendered.
	 * @returns A percentage between 0 and 100.
	 */
	protected estimatePercentage(task: ITeamDashboardMemberTask): number {
		return toPercentage(task.duration, task.estimate ?? 0);
	}

	/**
	 * Nebular status for a percentage, so every bar and badge uses the same
	 * danger/warning/info/success scale as the rest of the app.
	 *
	 * Accepts `null` because a member's activity legitimately has none.
	 *
	 * @param value - A percentage between 0 and 100, or `null`.
	 * @returns The matching Nebular status name.
	 */
	protected statusFor(value: number | null | undefined): NbComponentStatus {
		return progressStatus(value ?? 0);
	}

	/**
	 * Rounded activity percentage rendered inside the member's badge.
	 *
	 * @param member - The member row being rendered.
	 * @returns The percentage, e.g. `"64%"`.
	 */
	protected activityLabel(member: ITeamDashboardMember): string {
		return `${Math.round(member.activity ?? 0)}%`;
	}
}
