import { Component, Input, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import {
	OrganizationProjects,
	OrganizationClients,
	OrganizationProjectsCreateInput,
	ProjectTypeEnum,
	CurrenciesEnum
} from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';

@Component({
	selector: 'ga-edit-org-projects',
	templateUrl: './edit-organization-projects.component.html'
})
export class EditOrganizationProjectsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	projects: OrganizationProjects[];
	clients: OrganizationClients[];
	types: string[] = Object.values(ProjectTypeEnum);
	currencies: string[] = Object.values(CurrenciesEnum);

	selectedClient: OrganizationClients;
	selectedType: string;
	selectedCurrency: string;
	startDateValue: Date;
	endDateValue: Date;
	defaultCurrency: string;

	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private readonly organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadProjects();
				}
			});
	}

	async removeProject(id: string, name: string) {
		await this.organizationProjectsService.delete(id);

		this.toastrService.primary(
			`Project ${name} successfully removed!`,
			'Success'
		);

		this.loadProjects();
	}

	async onClientsSelected(id) {
		const res = await this.organizationClientsService.getAll(['projects'], {
			id
		});

		if (res) {
			this.selectedClient = res.items[0];
		} else {
			this.selectedClient = null;
		}
	}

	private async addProject(project: OrganizationProjectsCreateInput) {
		if (project.name) {
			await this.organizationProjectsService.create(project);

			this.toastrService.primary(
				`New project ${project.name} successfully added!`,
				'Success'
			);

			this.showAddCard = !this.showAddCard;
			this.selectedClient = null;
			this.loadProjects();
		} else {
			this.toastrService.danger(
				'Please fill in the name of your project',
				'Invalid input'
			);
		}
	}

	private async loadProjects() {
		if (!this.organizationId) {
			return;
		}

		this.defaultCurrency = this.store.selectedOrganization
			? this.store.selectedOrganization.currency
			: 'USD';

		const res = await this.organizationProjectsService.getAll(['client'], {
			organizationId: this.organizationId
		});
		if (res) {
			this.projects = res.items;
		}
	}

	private async loadClients() {
		if (!this.organizationId) {
			return;
		}

		const res = await this.organizationClientsService.getAll(['projects'], {
			organizationId: this.organizationId
		});
		if (res) {
			this.clients = res.items;
		}
	}
}
