import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import {
	Employee,
	OrganizationDepartment,
	OrganizationPositions,
	Organization
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';

@Component({
	selector: 'ga-edit-employee-main',
	templateUrl: './edit-employee-main.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: Employee;
	selectedOrganization: Organization;
	departments: OrganizationDepartment[] = [];
	positions: OrganizationPositions[] = [];

	constructor(
		private fb: FormBuilder,
		private store: Store,
		private toastrService: NbToastrService,
		private employeeStore: EmployeeStore,
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly organizationPositionsService: OrganizationPositionsService
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					await this.getDepartments();
					this._initializeForm(this.selectedEmployee);
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				console.log(this.selectedOrganization);
				if (this.selectedOrganization) {
					this.getPositions();
				}
			});
	}

	private async getDepartments() {
		const { items } = await this.organizationDepartmentsService.getAll([], {
			organizationId: this.selectedEmployee.orgId
		});
		this.departments = items;
	}

	private getPositions() {
		this.organizationPositionsService
			.getAll({ organizationId: this.selectedOrganization.id })
			.then((data) => {
				const { items } = data;
				this.positions = items;
			});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.userForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(employee: Employee) {
		// TODO: Implement Departments and Positions!
		this.form = this.fb.group({
			username: [employee.user.username],
			email: [employee.user.email, Validators.required],
			firstName: [employee.user.firstName, Validators.required],
			lastName: [employee.user.lastName, Validators.required],
			imageUrl: [employee.user.imageUrl, Validators.required],
			organizationDepartment: [employee.organizationDepartment || null],
			organizationPosition: [employee.organizationPosition || null]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
