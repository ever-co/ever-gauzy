import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import * as moment from 'moment-timezone';
import { ITeamPerson, activityTone, formatDuration, formatPercent } from '../team-dashboard.utils';

/**
 * A member's hover card on the Teams dashboard.
 *
 * Built on the team page's assignee card (`view-team` > Team tasks) — banner,
 * photo with presence, name, about, profile link — and adds what a team lead
 * looks for at a glance: the person's role and team, their local time, and
 * their day so far (time, activity, tasks, share of the working day, and what
 * they are working on). Rendered inside an `nbPopover` with
 * `nbPopoverClass="person-popover"`.
 */
@Component({
	selector: 'gauzy-team-person-card',
	templateUrl: './team-person-card.component.html',
	styleUrls: ['../../../employees/view-employee/view-employee.component.scss', './team-person-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TeamPersonCardComponent {
	protected readonly formatDuration = formatDuration;
	protected readonly formatPercent = formatPercent;
	protected readonly activityTone = activityTone;

	private _person: ITeamPerson;
	public get person(): ITeamPerson {
		return this._person;
	}
	@Input() public set person(value: ITeamPerson) {
		this._person = value;
		this.localTime = this._localTimeOf(value?.timeZone);
	}

	/** The person's local time, as the employee page shows it; `null` without a known zone. */
	protected localTime: string | null = null;

	private _localTimeOf(zone: string | null | undefined): string | null {
		if (!zone || !moment.tz.zone(zone)) {
			return null;
		}
		return moment().tz(zone).format('LT');
	}
}
