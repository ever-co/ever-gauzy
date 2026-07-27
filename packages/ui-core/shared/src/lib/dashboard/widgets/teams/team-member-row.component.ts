import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NbBadgeModule, NbComponentStatus, NbProgressBarModule } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { ComponentsModule } from '../../../components/components.module';
import { DurationFormatPipe } from '../../../pipes/duration-format.pipe';
import { ITeamDashboardMember } from './teams-dashboard.types';
import { toPercentage } from './teams-widget.utils';

/**
 * The compact member row of the Teams dashboard: status dot, avatar, how much of
 * the working day is logged, and the activity badge.
 *
 * Extracted from `gauzy-team-member` in its "classic" mode, and shared by every
 * Teams widget that lists people — the flat member list and the per-team overview
 * both render this exact row, so the chrome cannot drift between them.
 *
 * Purely presentational: it fetches nothing and owns no state.
 */
@Component({
	selector: 'ga-team-member-row',
	templateUrl: './team-member-row.component.html',
	styleUrls: ['./team-member-row.component.scss'],
	standalone: true,
	imports: [NbBadgeModule, NbProgressBarModule, TranslateModule, ComponentsModule, DurationFormatPipe],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamMemberRowComponent {
	/** The member to render. */
	readonly member = input.required<ITeamDashboardMember>();

	/**
	 * Whether to print the member's team under their name.
	 *
	 * Only useful in a FLAT list spanning several teams; inside a per-team card it
	 * would repeat the card's own heading on every row.
	 */
	readonly showTeamName = input<boolean>(false);

	/**
	 * Share of the member's working day that is already logged.
	 *
	 * @returns A percentage between 0 and 100.
	 */
	protected workedPercentage(): number {
		const member = this.member();
		return toPercentage(member.workedDuration, member.workPeriod);
	}

	/**
	 * Nebular status for a percentage, so the progress bars and activity badges
	 * use the same danger/warning/info/success scale as the rest of the app.
	 *
	 * Accepts `null` because a member's activity legitimately has none — the
	 * template guards the BADGE on that, but Angular does not narrow a
	 * `member().activity` call expression across the surrounding `@if`.
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
	 * Formatted here rather than through the decimal pipe so the row does not have
	 * to pull `CommonModule` in just for one number.
	 *
	 * @returns The percentage, e.g. `"64%"`.
	 */
	protected activityLabel(): string {
		return `${Math.round(this.member().activity ?? 0)}%`;
	}
}
