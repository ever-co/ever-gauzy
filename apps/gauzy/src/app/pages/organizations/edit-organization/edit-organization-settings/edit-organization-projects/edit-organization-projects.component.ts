import { Component, OnInit } from '@angular/core';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProjects,
	OrganizationProjectsCreateInput,
	PermissionsEnum
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from '../../../../../@core/services';
import { OrganizationContactService } from '../../../../../@core/services/organization-contact.service';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { OrganizationProjectsService } from '../../../../../@core/services/organization-projects.service';
import { Store } from '../../../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-projects',
	templateUrl: './edit-organization-projects.component.html',
	styleUrls: ['./edit-organization-projects.component.scss']
})
export class EditOrganizationProjectsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organization: Organization;
	showAddCard: boolean;
	projects: OrganizationProjects[];
	organizationContacts: OrganizationContact[];
	employees: Employee[] = [];
	projectToEdit: OrganizationProjects;
	viewPrivateProjects: boolean;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organization = organization;
					this.loadProjects();
					this.loadEmployees();
					this.loadOrganizationContacts();
				}
			});
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.viewPrivateProjects = this.store.hasPermission(
					PermissionsEnum.ACCESS_PRIVATE_PROJECTS
				);
			});
	}

	private async loadEmployees() {
		if (!this.organization) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organization.id } })
			.pipe(first())
			.toPromise();

		this.employees = items;
	}

	async removeProject(id: string, name: string) {
		await this.organizationProjectsService.delete(id);

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadProjects();
	}

	cancel() {
		this.projectToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	private async addOrEditProject(project: OrganizationProjectsCreateInput) {
		if (project.name) {
			await this.organizationProjectsService.create(project);

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
					{
						name: project.name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.projectToEdit = null;
			this.showAddCard = !this.showAddCard;
			this.loadProjects();
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.INVALID_PROJECT_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_PROJECT_INVALID_NAME'
				)
			);
		}
	}

	private async loadProjects() {
		if (!this.organization) {
			return;
		}

		const res = await this.organizationProjectsService.getAll(
			['organizationContact', 'members', 'members.user', 'tags'],
			{
				organizationId: this.organization.id
			}
		);
		if (res) {
			const canView = [];
			if (this.viewPrivateProjects) {
				this.projects = res.items;
			} else {
				res.items.forEach((item) => {
					if (item.public) {
						canView.push(item);
					} else {
						item.members.forEach((member) => {
							if (member.id === this.store.userId) {
								canView.push(item);
							}
						});
					}
				});
				this.projects = canView;
			}
		}
	}

	private async loadOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const res = await this.organizationContactService.getAll(['projects'], {
			organizationId: this.organization.id
		});
		if (res) {
			this.organizationContacts = res.items;
		}
	}

	async editProject(project: OrganizationProjects) {
		this.projectToEdit = project;
		this.showAddCard = true;
	}
}
