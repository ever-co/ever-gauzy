import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Params } from '@angular/router';
import {
	Employee,
	Organization,
	OrganizationDepartment,
	OrganizationEmploymentType,
	OrganizationPositions
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { EmployeeLevelService } from 'apps/gauzy/src/app/@core/services/employee-level.service';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEmploymentTypesService } from 'apps/gauzy/src/app/@core/services/organization-employment-types.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';
import { EmployeesService } from '../../../../../@core/services/employees.service';

@Component({
	selector: 'ga-edit-employee-employment',
	templateUrl: './edit-employee-employment.component.html',
	styleUrls: ['./edit-employee-employment.component.scss']
})
export class EditEmployeeEmploymentComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: Employee;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employmentTypes: OrganizationEmploymentType[];
	employeeLevels: { level: string; organizationId: string }[] = [];
	selectedOrganization: Organization;
	departments: OrganizationDepartment[] = [];
	positions: OrganizationPositions[] = [];

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly employeeStore: EmployeeStore,
		private readonly employeeService: EmployeesService,
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypesService
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (emp) => {
				this.selectedEmployee = emp;

				if (this.selectedEmployee) {
					this.getDepartments();
					this._initializeForm(this.selectedEmployee);
				}

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
						if (this.selectedOrganization) {
							this.getPositions();
							this.getEmploymentTypes();
							this.getEmployeeLevels();
						}
					});
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

	private getEmploymentTypes() {
		this.organizationEmploymentTypeService
			.getAll([], {
				organizationId: this.selectedOrganization.id
			})
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((types) => {
				this.employmentTypes = types.items;
			});
	}

	private getEmployeeLevels() {
		this.employeeLevelService
			.getAll(this.selectedOrganization.id)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.employeeLevels = data['items'];
			});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(employee: Employee) {
		this.form = this.fb.group({
			organizationEmploymentTypes: [
				employee.organizationEmploymentTypes || null
			],
			employeeLevel: [employee.employeeLevel || ''],
			anonymousBonus: [employee.anonymousBonus],
			organizationDepartments: [employee.organizationDepartments || null],
			organizationPosition: [employee.organizationPosition || null]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
