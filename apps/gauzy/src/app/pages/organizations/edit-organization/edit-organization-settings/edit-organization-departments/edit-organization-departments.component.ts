import { Component, OnInit } from '@angular/core';
import {
	Employee,
	OrganizationDepartment,
	OrganizationDepartmentCreateInput
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

@Component({
	selector: 'ga-edit-org-departments',
	templateUrl: './edit-organization-departments.component.html',
	styleUrls: ['./edit-organization-departments.component.scss']
})
export class EditOrganizationDepartmentsComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationId: string;

	showAddCard: boolean;

	departments: OrganizationDepartment[];
	employees: Employee[] = [];
	departmentToEdit: OrganizationDepartment;

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService,
		private readonly organizationEditStore: OrganizationEditStore,
		private readonly employeesService: EmployeesService
	) {}

	ngOnInit() {
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.loadDepartments();
					this.loadEmployees();
				}
			});
	}

	cancel() {
		this.departmentToEdit = null;
		this.showAddCard = !this.showAddCard;
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

	async removeDepartment(id: string, name: string) {
		await this.organizationDepartmentsService.delete(id);
		this.toastrService.primary(
			name + ' Department successfully removed!',
			'Success'
		);
		this.loadDepartments();
	}

	async editDepartment(department: OrganizationDepartment) {
		this.departmentToEdit = department;
		this.showAddCard = true;
	}

	private async addOrEditDepartment(
		input: OrganizationDepartmentCreateInput
	) {
		if (input.name) {
			this.departmentToEdit
				? await this.organizationDepartmentsService.update(
						this.departmentToEdit.id,
						input
				  )
				: await this.organizationDepartmentsService.create(input);

			this.cancel();

			this.toastrService.primary(
				input.name + ' Department successfully added!',
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
		if (!this.organizationId) {
			return;
		}

		const res = await this.organizationDepartmentsService.getAll(
			['members', 'members.user'],
			{
				organizationId: this.organizationId
			}
		);
		if (res) {
			this.departments = res.items;
		}
	}
}
