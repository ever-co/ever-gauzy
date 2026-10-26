import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import {
	IMemberRow,
	IRankedMember,
	ITeamRow,
	activityTone,
	formatDuration,
	formatPercent
} from '../team-dashboard.utils';
import { PersonCardKeyboard, personCardId } from '../person-card-keyboard';

/** Organization-wide figures of the overview's summary strip. */
export interface ITeamsOverview {
	teamsWorked: number;
	membersWorked: number;
	membersTotal: number;
	projectsWorked: number;
	duration: number;
	activity: number;
}

/**
 * The "All teams" tab of the Teams dashboard: the organization's summary strip,
 * every team with its day — each row opening onto its members and their
 * working-day bars — and who worked the most.
 */
@Component({
	selector: 'gauzy-all-team',
	templateUrl: './all-team.component.html',
	styleUrls: [
		'../../../employees/view-employee/view-employee.component.scss',
		'../team-dashboard.shared.scss',
		'./all-team.component.scss'
	],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class AllTeamComponent {
	public readonly formatDuration = formatDuration;
	public readonly formatPercent = formatPercent;
	public readonly activityTone = activityTone;

	/** Keyboard access to the Top members' hover cards. */
	protected readonly cardKeyboard = new PersonCardKeyboard();
	/** Prefix of the Top members' card ids; each line adds its index. */
	protected readonly cardIdPrefix = personCardId();

	@Input() public teams: ITeamRow[] = [];
	@Input() public membersByTeam: Record<string, IMemberRow[]> = {};
	@Input() public topMembers: IRankedMember[] = [];
	@Input() public overview: ITeamsOverview;
	@Input() public projectCount = 0;

	/** Emits the id of the team to open. */
	@Output() public readonly selectedTeam = new EventEmitter<string>();

	/** Teams whose members are listed under their row. */
	public expanded = new Set<string>();

	public get allExpanded(): boolean {
		return this.teams.length > 0 && this.teams.every((team) => this.expanded.has(team.id));
	}

	public onSelectTeam(teamId: string): void {
		this.selectedTeam.emit(teamId);
	}

	public toggle(teamId: string): void {
		if (this.expanded.has(teamId)) {
			this.expanded.delete(teamId);
		} else {
			this.expanded.add(teamId);
		}
	}

	public toggleAll(): void {
		this.expanded = this.allExpanded ? new Set() : new Set(this.teams.map((team) => team.id));
	}
}
