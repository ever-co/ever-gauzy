import { ChangeDetectionStrategy, Component, computed, Signal } from '@angular/core';
import { NbBadgeModule, NbComponentStatus } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { IMembersStatistics } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/ui-core/common';
import { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import { ComponentsModule, DurationFormatPipe } from '@gauzy/ui-core/shared';
import { BaseTimeTrackListWidgetComponent } from './base-time-track-list-widget.component';
import { TimeTrackWidgetStateComponent } from './time-track-widget-state.component';
import { isMoreThanWeekRange, IWeekHourBar, RangePeriod, toWeekHourBars } from './time-track-widget.utils';

/**
 * A member row plus its pre-computed weekly bar graph.
 *
 * The bars are derived once, when the payload arrives, instead of from a
 * template helper: a method called out of `@for` would rebuild all seven bars on
 * every change-detection pass.
 */
interface IMemberRow extends IMembersStatistics {
	/** Seven bars (Sunday..Saturday), each a share of the member's own week. */
	weekHourBars: IWeekHourBar[];
}

/**
 * List widget: per-member time and activity, today and over the selected range.
 *
 * Wraps the legacy dashboard's "Members" window — avatar, today's duration and
 * activity badge, the range's duration and activity badge, plus the little
 * per-day bar graph the legacy panel drew for ranges up to a week.
 *
 * NOTE: this is the LIST panel. The single number "how many members worked"
 * lives in the separate `time-tracking.members-worked` counter widget.
 */
@Component({
	selector: 'gz-members-list-widget',
	templateUrl: './members-list-widget.component.html',
	styleUrls: ['./time-track-list-widget.scss'],
	standalone: true,
	imports: [NbBadgeModule, TranslateModule, ComponentsModule, DurationFormatPipe, TimeTrackWidgetStateComponent],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersListWidgetComponent extends BaseTimeTrackListWidgetComponent<IMemberRow> {
	/** @inheritdoc */
	protected readonly emptyMessageBaseKey = 'TIMESHEET.NO_MEMBER_ACTIVITY';

	/**
	 * Whether the per-day bar graph is drawn.
	 *
	 * Beyond a week the seven bars no longer map onto seven real days, which is
	 * exactly when the legacy panel dropped them too.
	 */
	protected readonly showWeekGraph: Signal<boolean> = computed(() => !isMoreThanWeekRange(this.widgetContext()));

	/** Header label of the range column: "This week" or "Over the period". */
	protected readonly rangeColumnKey: Signal<string> = computed(() =>
		this.rangePeriod() === RangePeriod.PERIOD ? 'TIMESHEET.OVER_PERIOD' : 'TIMESHEET.THIS_WEEK'
	);

	/**
	 * Reads the per-member statistics for the current scope.
	 *
	 * @param context - The dashboard context to query for.
	 * @returns The member rows, with their weekly bars already normalized.
	 */
	protected override fetch(context: IDashboardWidgetContext): Observable<IMemberRow[]> {
		return this.statisticsCache.getMembers(context).pipe(
			map((members: IMembersStatistics[]) =>
				(members ?? []).map((member: IMembersStatistics) => ({
					...member,
					weekHourBars: toWeekHourBars(member?.weekHours)
				}))
			)
		);
	}

	/**
	 * Nebular status for an activity percentage, so the badges use the same
	 * danger/warning/info/success scale as the rest of the app.
	 *
	 * @param value - A percentage between 0 and 100.
	 * @returns The matching Nebular status name.
	 */
	protected statusFor(value: number | undefined): NbComponentStatus {
		return progressStatus(value ?? 0);
	}

	/**
	 * Activity percentage rendered inside a member's badge.
	 *
	 * @param value - A percentage between 0 and 100.
	 * @returns The percentage, e.g. `"64%"`.
	 */
	protected activityLabel(value: number | undefined): string {
		return `${Math.round(value ?? 0)}%`;
	}
}
