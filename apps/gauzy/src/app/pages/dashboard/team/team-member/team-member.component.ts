import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { IMemberRow, activityTone, formatDuration, formatPercent } from '../team-dashboard.utils';
import { PersonCardKeyboard } from '../person-card-keyboard';

/** Tasks listed in a row before "Show all". */
const VISIBLE_TASKS = 2;

/**
 * One member of the Teams dashboard.
 *
 * Attached to a `<tr>` it renders the cells of the members table — every task
 * of the day with its time and estimate bar, and the day's time against the
 * working day. With `isClassic` (on any block element) it renders the compact
 * line listed under a team in the "All teams" overview.
 */
@Component({
	selector: '[gauzy-team-member]',
	templateUrl: './team-member.component.html',
	styleUrls: [
		'../../../employees/view-employee/view-employee.component.scss',
		'../team-dashboard.shared.scss',
		'./team-member.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class TeamMemberComponent {
	public readonly formatDuration = formatDuration;
	public readonly formatPercent = formatPercent;
	public readonly activityTone = activityTone;

	/** Keyboard access to the member's hover card. */
	protected readonly cardKeyboard = new PersonCardKeyboard();

	/** `true` renders the compact overview line instead of table cells. */
	@Input() public isClassic = false;

	private _member: IMemberRow;
	public get member(): IMemberRow {
		return this._member;
	}
	@Input() public set member(value: IMemberRow) {
		this._member = value;
		this.showAllTasks = false;
	}

	public showAllTasks = false;

	public get visibleTasks() {
		const tasks = this.member?.tasks ?? [];
		return this.showAllTasks ? tasks : tasks.slice(0, VISIBLE_TASKS);
	}

	public get hiddenTasks(): number {
		return Math.max((this.member?.tasks?.length ?? 0) - VISIBLE_TASKS, 0);
	}
}
