import { Component, Input } from '@angular/core';
import { ITask } from '@gauzy/contracts';

@Component({
	selector: 'ngx-assigned-to',
	templateUrl: './assigned-to.component.html',
})
export class AssignedToComponent {

	@Input() rowData: any;
	@Input() value: any;

	public view: 'members' | 'teams';

	ngOnInit() {
		if (this.rowData) {
			if (this.rowData.members && this.rowData.members.length > 0) {
				this.view = 'members';
				this.value = [...this.rowData.members];
			} else if (this.rowData.teams && this.rowData.teams.length > 0) {
				this.view = 'teams';
				this.value = this._getTeamNames(this.rowData);
			}
		}
	}

	/**
	 * Extracts an array of team names from the given task.
	 * @param task The task object.
	 * @returns An array of team names.
	 */
	private _getTeamNames(task: ITask): string[] {
		if (task?.teams && Array.isArray(task.teams)) {
			return task.teams.map((team) => team.name);
		}
		return [];
	}
}
