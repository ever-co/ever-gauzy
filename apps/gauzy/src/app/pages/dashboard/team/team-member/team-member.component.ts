import { Component, Input, OnInit } from '@angular/core';
import * as moment from 'moment';
import { IOrganizationTeamEmployee } from '@gauzy/contracts';
import { progressStatus } from '@gauzy/ui-core/common';

@Component({
	selector: 'gauzy-team-member',
	templateUrl: './team-member.component.html',
	styleUrls: ['./team-member.component.scss']
})
export class TeamMemberComponent implements OnInit {
	private _member: IOrganizationTeamEmployee | any;

	public get member(): IOrganizationTeamEmployee | any {
		return this._member;
	}

	@Input()
	public set member(value: IOrganizationTeamEmployee | any) {
		this._member = value;
	}

	private _isClassic: boolean;

	public get isClassic(): boolean {
		return this._isClassic;
	}

	@Input()
	public set isClassic(value: boolean) {
		this._isClassic = value;
	}

	public progressStatus(value) {
		return progressStatus(value);
	}

	public calculatePercentage(a, b) {
		let value = Math.abs((a / b) * 100);
		value = isFinite(value) ? value : 0;
		return value;
	}

	public humanize(duration: number) {
		return moment.duration(duration, 'seconds').humanize();
	}

	constructor() {
		this._isClassic = false;
	}

	ngOnInit(): void {}
}
