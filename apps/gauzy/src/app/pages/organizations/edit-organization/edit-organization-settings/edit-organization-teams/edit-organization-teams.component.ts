import { Component, OnInit } from '@angular/core';
import {
	Employee,
	Organization,
	OrganizationTeamCreateInput,
	OrganizationTeam,
	Tag,
	RolesEnum
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationTeamsService } from 'apps/gauzy/src/app/@core/services/organization-teams.service';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-teams',
	templateUrl: './edit-organization-teams.component.html',
	styleUrls: ['./edit-organization-teams.component.scss']
})
export class EditOrganizationTeamsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	selectedOrg: Organization;

	organizationId: string;
	showAddCard: boolean;
	teams: OrganizationTeam[];
	employees: Employee[] = [];
	teamToEdit: OrganizationTeam;
	loading = true;
	tags: Tag[] = [];

	constructor(
		private readonly organizationTeamsService: OrganizationTeamsService,
		private employeesService: EmployeesService,
		private readonly toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private readonly organizationEditStore: OrganizationEditStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadTeams();
					this.loadEmployees();
				}
			});
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
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.EDIT_EXISTING_TEAM',
							{
								name: team.name
							}
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
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
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM',
							{
								name: team.name
							}
						),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);

					this.loadTeams();
				} catch (error) {
					console.error(error);
				}
			}
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.INVALID_TEAM_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_TEAM_INVALID_NAME'
				)
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
					this.getTranslation(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.REMOVE_TEAM',
						{
							name: name
						}
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);

				this.loadTeams();
			} catch (error) {
				console.error(error);
			}
		}
	}

	editTeam(team: OrganizationTeam) {
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
		if (!this.organizationId) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user', 'tags'], {
				organization: { id: this.organizationId }
			})
			.pipe(first())
			.toPromise();
		this.employees = items;
	}
	public getTagsByEmployeeId(id: string) {
		const employee = this.employees.find((empl) => empl.id === id);

		return employee ? employee.tags : [];
	}

	async loadTeams() {
		if (!this.organizationId) {
			return;
		}
		const { items: teams } = await this.organizationTeamsService.getAll(
			['members', 'tags', 'members.role'],
			{
				organizationId: this.organizationId
			}
		);
		if (teams) {
			teams.forEach((team: OrganizationTeam) => {
				team.managers = team.members.filter(
					(member) =>
						member.role && member.role.name === RolesEnum.MANAGER
				);
				team.members = team.members.filter((member) => !member.role);
			});

			this.teams = [...teams].sort(
				(a, b) => b.members.length - a.members.length
			);
		}
		this.loading = false;
	}
}
