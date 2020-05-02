import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { OrganizationTeam, Employee } from '@gauzy/models';

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
	team?: OrganizationTeam;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditTeam = new EventEmitter();

	members: string[];
	name: string;
	selectedEmployees: string[];

	ngOnInit() {
		if (this.team) {
			this.selectedEmployees = this.team.members.map(
				(member) => member.employeeId
			);
			this.name = this.team.name;
		}
	}

	addOrEditTeams() {
		this.addOrEditTeam.emit({
			name: this.name,
			members: this.members || this.selectedEmployees,
			organizationId: this.organizationId
		});

		this.name = '';
	}

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	cancel() {
		this.canceled.emit();
	}
}
