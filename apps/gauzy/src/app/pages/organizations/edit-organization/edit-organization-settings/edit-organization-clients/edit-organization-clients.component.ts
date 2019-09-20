import { Component, Input, OnInit } from '@angular/core';
import {
	OrganizationClients,
	OrganizationClientsCreateInput,
	OrganizationProjects
} from '@gauzy/models';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';

@Component({
	selector: 'ga-edit-org-clients',
	templateUrl: './edit-organization-clients.component.html'
})
export class EditOrganizationClientsComponent implements OnInit {
	@Input()
	organizationId: string;

	showAddCard: boolean;

	clients: OrganizationClients[];

	projects: OrganizationProjects[];

	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly organizationProjectsService: OrganizationProjectsService
	) {}

	ngOnInit(): void {
		this.loadClients();
		this.loadClients();
	}

	async removeClient(id: string) {
		await this.organizationClientsService.delete(id);

		this.loadClients();
		this.loadProjects();
	}

	private async addClient(client: OrganizationClientsCreateInput) {
		await this.organizationClientsService.create(client);

		this.showAddCard = !this.showAddCard;
		this.loadClients();
	}

	private async loadClients() {
		const res = await this.organizationClientsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.clients = res.items;
		}
	}

	private async loadProjects() {
		const res = await this.organizationProjectsService.getAll();
		if (res) {
			this.projects = res.items;
		}
	}
}
