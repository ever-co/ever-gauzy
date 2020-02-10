import { Component, OnInit } from '@angular/core';
import {
	Employee,
	OrganizationClients,
	OrganizationClientsCreateInput,
	OrganizationProjects
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationClientsService } from 'apps/gauzy/src/app/@core/services/organization-clients.service ';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-org-clients',
	templateUrl: './edit-organization-clients.component.html',
	styleUrls: ['./edit-organization-clients.component.scss']
})
export class EditOrganizationClientsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	clients: OrganizationClients[] = [];

	projectsWithoutClients: OrganizationProjects[];

	selectProjects: string[] = [];

	employees: Employee[] = [];

	clientToEdit: OrganizationClients;

	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly employeesService: EmployeesService
	) {}

	ngOnInit(): void {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadClients();
					this.loadProjectsWithoutClients();
					this.loadEmployees();
				}
			});
	}

	async removeClient(id: string, name: string) {
		await this.organizationClientsService.delete(id);

		this.toastrService.primary(
			`Client ${name} successfully removed!`,
			'Success'
		);

		this.loadClients();
	}

	private async addOrEditClient(client: OrganizationClientsCreateInput) {
		if (client.name && client.primaryEmail && client.primaryPhone) {
			await this.organizationClientsService.create(client);

			this.showAddCard = !this.showAddCard;
			this.selectProjects = [];

			this.toastrService.primary(
				`New client ${client.name} successfully added!`,
				'Success'
			);

			this.loadClients();
		} else {
			this.toastrService.danger(
				'Please check the Name, Primary Email and Primary Phone of your client',
				'Invalid input'
			);
		}
	}

	private async loadClients() {
		if (!this.organizationId) {
			return;
		}

		const res = await this.organizationClientsService.getAll(
			['projects', 'members', 'members.user'],
			{
				organizationId: this.organizationId
			}
		);
		if (res) {
			this.clients = res.items;
		}
	}

	private async loadProjectsWithoutClients() {
		const res = await this.organizationProjectsService.getAll(['client'], {
			organizationId: this.organizationId,
			client: null
		});

		if (res) {
			this.projectsWithoutClients = res.items;
		}
	}

	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organizationId } })
			.pipe(first())
			.toPromise();

		this.employees = items;
	}

	cancel() {
		this.clientToEdit = null;
		this.showAddCard = !this.showAddCard;
	}

	async editClient(client: OrganizationClients) {
		await this.loadProjectsWithoutClients();
		this.clientToEdit = client;
		this.showAddCard = true;
	}

	async add() {
		await this.loadProjectsWithoutClients();
		this.clientToEdit = null;
		this.showAddCard = true;
	}
}
