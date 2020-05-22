import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-assigned-to',
	templateUrl: './assigned-to.component.html',
})
export class AssignedToComponent implements ViewCell {
	@Input()
	rowData: any;

	@Input()
	value: any;

	view;

	constructor() {}

	ngOnInit() {
		if (this.rowData) {
			console.log(this.value);
			if (this.rowData.members && this.rowData.members.length > 0) {
				this.view = 'members';
				this.value = [...this.rowData.members];
			} else if (this.rowData.teams && this.rowData.teams.length > 0) {
				this.view = 'teams';
				this.value = this._getTeamNames(this.rowData);
			}
		}
	}

	private _getTeamNames(task) {
		if (task.teams && Array.isArray(task.teams)) {
			return task.teams.map((team) => team.name);
		}
		return [];
	}
}
