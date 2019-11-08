import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import {
	OrganizationTeams,
	Organization,
	Employee,
	OrganizationTeamCreateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';
import { OrganizationTeamsService } from 'apps/gauzy/src/app/@core/services/organization-teams.service';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ActivatedRoute } from '@angular/router';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ga-edit-org-teams',
	templateUrl: './edit-organization-teams.component.html',
	styleUrls: ['./edit-organization-teams.component.scss']
})
export class EditOrganizationTeamsComponent implements OnInit {
	@Input()
	selectedOrg: Organization;

	organizationId: string;
	showAddCard: boolean;
	teams: OrganizationTeams[];
	employees: Employee[] = [];
	teamToEdit: OrganizationTeams;

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private employeesService: EmployeesService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private route: ActivatedRoute,
		private dialogService: NbDialogService
	) {}

	async ngOnInit() {
		const { id } = await this.route.params.pipe(first()).toPromise();

		this.organizationId = this.store.selectedOrganization
			? this.store.selectedOrganization.id
			: id;

		this.loadTeams();
		this.loadEmployees();
	}

	async addOrEditTeam(team: OrganizationTeamCreateInput) {
		if (team.name && team.name.trim().length && team.members.length) {
			if (this.teamToEdit) {
				try {
					await this.organizationTeamsService.update(
						this.teamToEdit.id,
						team
					);

					this.toastrService.primary(
						`Team ${team.name} successfully updated!`,
						'Success'
					);

					this.loadTeams();
				} catch (error) {
					console.error(error);
				}

				this.showAddCard = false;
			} else {
				try {
					await this.organizationTeamsService.create(team);

					this.toastrService.primary(
						`New team ${team.name} successfully added!`,
						'Success'
					);

					this.loadTeams();
				} catch (error) {
					console.error(error);
				}
			}
		} else {
			this.toastrService.danger(
				'Please add a Team name and at least one member',
				'Team name and members are required'
			);
		}

		this.showAddCard = false;
		this.teamToEdit = null;
	}

	async removeTeam(id: string, name: string) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Team'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationTeamsService.delete(id);

				this.toastrService.primary(
					`Team ${name} successfully removed!`,
					'Success'
				);

				this.loadTeams();
			} catch (error) {
				console.error(error);
			}
		}
	}

	editTeam(team: OrganizationTeams) {
		this.showAddCard = !this.showAddCard;
		this.teamToEdit = team;
		this.showAddCard = true;
		// TODO: Scroll the page to the top!
	}

	cancel() {
		this.showAddCard = !this.showAddCard;
		this.teamToEdit = null;
	}

	private async loadEmployees() {
		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organizationId } })
			.pipe(first())
			.toPromise();

		this.employees = items;
	}

	private async loadTeams() {
		const teams = await this.organizationTeamsService.getAll(['members'], {
			organizationId: this.organizationId
		});

		if (teams) {
			this.teams = teams.items.sort(
				(a, b) => b.members.length - a.members.length
			);
		}
	}
}
