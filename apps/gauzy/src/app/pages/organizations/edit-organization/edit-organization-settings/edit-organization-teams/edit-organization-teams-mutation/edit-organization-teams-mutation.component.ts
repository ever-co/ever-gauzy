import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import {
	OrganizationTeam,
	Employee,
	OrganizationTeamEmployee
} from '@gauzy/models';

@Component({
	selector: 'ngx-edit-organization-teams-mutation',
	templateUrl: './edit-organization-teams-mutation.component.html',
	styleUrls: ['./edit-organization-teams-mutation.component.scss']
})
export class EditOrganizationTeamsMutationComponent implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	organizationId: string;
	@Input()
	managerId: string;
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
	teamEmployees: OrganizationTeamEmployee[] = [];

	ngOnInit() {
		if (this.team) {
			this.selectedEmployees = this.team.members
				.filter((member) => member.roleId !== this.managerId)
				.map((member) => member.employeeId);
			this.selectedManagers = this.team.members
				.filter((member) => member.roleId === this.managerId)
				.map((member) => member.employeeId);
			this.name = this.team.name;
		}
	}

	addOrEditTeams() {
		this.members = this.members || this.selectedEmployees;
		this.managers = this.managers || this.selectedManagers;

		if (
			this.managers &&
			this.managers.length &&
			this.members &&
			this.members.length
		)
			this.managers.forEach(
				(manager) =>
					(this.members = this.members.filter(
						(member) => member !== manager
					))
			);

		if (this.members && this.members.length) {
			this.members.forEach((member) => {
				const teamEmployee: OrganizationTeamEmployee = {
					employeeId: member
				};
				this.teamEmployees.push(teamEmployee);
			});
		}

		if (this.managers && this.managers.length) {
			this.managers.forEach((manager) => {
				const teamEmployee: OrganizationTeamEmployee = {
					employeeId: manager,
					roleId: this.managerId
				};
				this.teamEmployees.push(teamEmployee);
			});
		}

		this.addOrEditTeam.emit({
			name: this.name,
			organizationId: this.organizationId,
			members: this.teamEmployees
		});

		this.name = '';
		this.teamEmployees = [];
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
}
