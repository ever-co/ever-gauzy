import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { IEmployee, IOrganizationTeam, RolesEnum } from '@gauzy/contracts';

@Component({
    selector: 'gauzy-team-card',
    templateUrl: './team-card.component.html',
    styleUrls: ['./team-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class TeamCardComponent implements OnInit {
	constructor() {}

	_managers: IEmployee[];
	get managers(): IEmployee[] {
		return this._team.members
			.filter((member) => member.role && member.role.name === RolesEnum.MANAGER)
			.map((item) => item.employee);
	}

	_members: IEmployee[];
	get members(): IEmployee[] {
		return this._team.members.filter((member) => !member.role).map((item) => item.employee);
	}

	private _team: IOrganizationTeam | any;
	public get team(): IOrganizationTeam | any {
		return this._team;
	}
	@Input() public set team(value: IOrganizationTeam | any) {
		this._team = value;
	}

	ngOnInit(): void {}
}
