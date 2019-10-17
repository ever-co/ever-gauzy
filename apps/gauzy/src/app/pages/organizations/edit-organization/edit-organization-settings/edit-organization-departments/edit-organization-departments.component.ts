import { Component, Input, OnInit } from '@angular/core';
import { OrganizationDepartment } from '@gauzy/models';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { NbToastrService } from '@nebular/theme';

@Component({
	selector: 'ga-edit-org-departments',
	templateUrl: './edit-organization-departments.component.html'
})
export class EditOrganizationDepartmentsComponent implements OnInit {
	@Input()
	organizationId: string;

	showAddCard: boolean;

	departments: OrganizationDepartment[];

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService
	) {}

	ngOnInit() {
		this.loadDepartments();
	}

	async removeDepartment(id: string, name: string) {
		await this.organizationDepartmentsService.delete(id);
		this.toastrService.primary(
			name + ' Department successfully removed!',
			'Success'
		);
		this.loadDepartments();
	}

	private async addDepartment(name: string) {
		if (name) {
			await this.organizationDepartmentsService.create({
				name,
				organizationId: this.organizationId
			});

			this.showAddCard = !this.showAddCard;
			this.toastrService.primary(
				name + ' Department successfully added!',
				'Success'
			);
			this.loadDepartments();
		} else {
			this.toastrService.danger(
				'Please add a Department name',
				'Department name is required'
			);
		}
	}

	private async loadDepartments() {
		const res = await this.organizationDepartmentsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.departments = res.items;
		}
	}
}
