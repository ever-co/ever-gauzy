import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import {
	OrganizationTeams,
	OrganizationClientsCreateInput,
	Organization,
	Employee
} from '@gauzy/models';
import { first } from 'rxjs/operators';
import { OrganizationTeamsService } from 'apps/gauzy/src/app/@core/services/organization-teams.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ga-edit-org-teams',
	templateUrl: './edit-organization-teams.component.html'
})
export class EditOrganizationTeamsComponent implements OnInit {
	@Input()
	selectedOrg: Organization;
	organizationId: string;
	store: Store;

	showAddCard: boolean;

	teams: OrganizationTeams[];
	members: Employee[];

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private employeesService: EmployeesService,
		private readonly toastrService: NbToastrService
	) {}

	ngOnInit(): void {
		this.loadTeams();
		this.loadEmployees();
	}

	async removeTeam(id: string, name: string) {
		await this.organizationTeamsService.delete(id);

		this.toastrService.primary(
			`Team ${name} successfully removed!`,
			'Success'
		);

		this.loadTeams();
	}

	private async addTeam(team: OrganizationClientsCreateInput) {
		if (team.name) {
			await this.organizationTeamsService.create(team);

			this.toastrService.primary(
				`New team ${team.name} successfully added!`,
				'Success'
			);

			this.showAddCard = !this.showAddCard;
			this.loadTeams();
		} else {
			this.toastrService.danger(
				'Please add a Team name',
				'Team name is required'
			);
		}
	}

	private async loadEmployees() {
		this.organizationId = await this.store.selectedOrganization.id;
		const { items } = await this.employeesService
			.getAll([], { organization: { id: this.organizationId } })
			.pipe(first())
			.toPromise();
		this.members = items;
	}

	private async loadTeams() {
		const res = await this.organizationTeamsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.teams = res.items;
		}
	}
}
