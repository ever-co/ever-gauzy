import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { IEmployee, ITag } from '@gauzy/models';

@Component({
	selector: 'ga-teams-mutation',
	templateUrl: './teams-mutation.component.html'
})
export class TeamsMutationComponent implements OnInit {
	@Input()
	employees: IEmployee[];
	@Input()
	organizationId: string;
	@Input()
	team?: any;
	@Input()
	isGridEdit: boolean;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditTeam = new EventEmitter();

	members: string[];
	managers: string[];
	name: string;
	selectedEmployees: string[];
	selectedManagers: string[];
	tags: ITag[] = [];

	ngOnInit() {
		if (this.team) {
			this.selectedEmployees = this.team.members.map((member) =>
				this.isGridEdit ? member.id : member.employeeId
			);
			this.selectedManagers = this.team.managers.map((manager) =>
				this.isGridEdit ? manager.id : manager.employeeId
			);
			this.name = this.isGridEdit ? this.team.team_name : this.team.name;
			this.tags = this.team.tags;
		}
	}

	addOrEditTeams() {
		this.addOrEditTeam.emit({
			name: this.name,
			members: this.members || this.selectedEmployees,
			managers: this.managers || this.selectedManagers,
			organizationId: this.organizationId,
			tags: this.tags
		});
		this.name = '';
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	onManagersSelected(managers: string[]) {
		this.managers = managers;
	}

	cancel() {
		this.canceled.emit();
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
