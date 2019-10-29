import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import {
	OrganizationTeams,
	Organization,
	Employee,
	User,
	OrganizationTeamCreateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';
import { OrganizationTeamsService } from 'apps/gauzy/src/app/@core/services/organization-teams.service';
import {
	EmployeesService,
	UsersService
} from 'apps/gauzy/src/app/@core/services';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ga-edit-org-teams',
	templateUrl: './edit-organization-teams.component.html'
})
export class EditOrganizationTeamsComponent implements OnInit {
	@Input()
	selectedOrg: Organization;

	organizationId: string;
	name: string;
	showAddCard: boolean;
	teams: OrganizationTeams[];
	employees: User[] = [];
	members: string[] = [];

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private employeesService: EmployeesService,
		private userService: UsersService,
		private readonly toastrService: NbToastrService,
		private store: Store
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

	onMembersSelected(members: string[]) {
		this.members = members;
	}

	private async addTeam() {
		if (this.name && this.name.trim().length) {
			const team = {
				name: this.name,
				organizationId: this.organizationId,
				members: this.members
			};

			try {
				await this.organizationTeamsService.create(team);

				this.toastrService.primary(
					`New team ${team.name} successfully added!`,
					'Success'
				);

				this.showAddCard = !this.showAddCard;
				this.loadTeams();
			} catch (error) {
				console.error(error);
			}
		} else {
			this.toastrService.danger(
				'Please add a Team name',
				'Team name is required'
			);
		}
	}

	private async loadEmployees() {
		this.organizationId = this.store.selectedOrganization.id;
		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organizationId } })
			.pipe(first())
			.toPromise();

		this.employees = items.map((emp) => emp.user);
	}

	private async loadTeams() {
		const res = await this.organizationTeamsService.getAll(['employees'], {
			organizationId: this.organizationId
		});

		console.log(res);

		if (res) {
			this.teams = res.items;
		}
	}
}
