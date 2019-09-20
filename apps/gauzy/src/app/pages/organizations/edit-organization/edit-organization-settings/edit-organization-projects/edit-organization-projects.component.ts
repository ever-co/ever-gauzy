import { Component, Input, OnInit } from '@angular/core';
import {
	OrganizationProjects,
	OrganizationClients,
	OrganizationProjectsCreateInput
} from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';

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

	selectedClient: OrganizationClients;

	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly organizationProjectsService: OrganizationProjectsService
	) {}

	ngOnInit(): void {
		this.loadProjects();
		this.loadClients();
	}

	async removeProject(id: string) {
		await this.organizationProjectsService.delete(id);

		this.loadProjects();
	}

	async onClientsSelected(id) {
		const res = await this.organizationClientsService.getAll({ id });

		if (res) {
			this.selectedClient = res.items[0];
		}
	}

	private async addProject(project: OrganizationProjectsCreateInput) {
		console.warn('TODO fix addProject');

		return;
		await this.organizationProjectsService.create(project);

		this.showAddCard = !this.showAddCard;
		this.loadProjects();
	}

	private async loadProjects() {
		const res = await this.organizationProjectsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.projects = res.items;
		}
	}

	private async loadClients() {
		const res = await this.organizationClientsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.clients = res.items;
		}
	}
}
