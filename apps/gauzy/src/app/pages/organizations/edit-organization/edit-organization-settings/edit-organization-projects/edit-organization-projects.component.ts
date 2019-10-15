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

@Component({
	selector: 'ga-edit-org-projects',
	templateUrl: './edit-organization-projects.component.html'
})
export class EditOrganizationProjectsComponent implements OnInit {
	@Input()
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
		private store: Store
	) {}

	ngOnInit(): void {
		this.loadProjects();
	}

	async removeProject(id: string, name: string) {
		await this.organizationProjectsService.delete(id);

		this.toastrService.info(
			`Project ${name} successfuly removed!`,
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
		await this.organizationProjectsService.create(project);

		this.toastrService.info(
			`New project ${project.name} successfuly added!`,
			'Success'
		);

		this.showAddCard = !this.showAddCard;
		this.selectedClient = null;
		this.loadProjects();
	}

	private async loadProjects() {
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
		const res = await this.organizationClientsService.getAll(['projects'], {
			organizationId: this.organizationId
		});
		if (res) {
			this.clients = res.items;
		}
	}
}
