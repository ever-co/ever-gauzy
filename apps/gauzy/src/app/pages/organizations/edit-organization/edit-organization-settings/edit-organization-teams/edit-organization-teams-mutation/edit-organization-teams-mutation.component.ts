import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { OrganizationTeam, Employee, Tag, RolesEnum } from '@gauzy/models';

@Component({
	selector: 'ga-edit-organization-teams-mutation',
	templateUrl: './edit-organization-teams-mutation.component.html',
	styleUrls: ['./edit-organization-teams-mutation.component.scss']
})
export class EditOrganizationTeamsMutationComponent implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organizationId: string;
	@Input()
	team?: OrganizationTeam;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditTeam = new EventEmitter();

	members: string[];
	managers: string[];
	name: string;
	selectedEmployees: string[];
	selectedManagers: string[];
	tags: Tag[] = [];

	ngOnInit() {
		if (this.team) {
			this.selectedEmployees = this.team.members.map(
				(member) => member.employeeId
			);
			this.selectedManagers = this.team.managers.map(
				(member) => member.employeeId
			);
			this.name = this.team.name;
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
