import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import {
	Employee,
  EmploymentTypes,
	OrganizationDepartment,
	OrganizationPositions,
	Organization
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../../../@core/services/employees.service';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';
import { EmployeeLevelService } from 'apps/gauzy/src/app/@core/services/employee-level.service';
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
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employmentTypes: EmploymentTypes[];
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

					this.employeeService
						.getEmploymentTypes(this.selectedEmployee.orgId)
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((data) => {
							this.employmentTypes = data;
						});
          
          this.employeeLevelService
						.getAll(this.selectedEmployee.orgId)
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((data) => {
							this.employeeLevels = data['items'];
						});                              
				}
      
      	this.employeeLevelService
			     .getAll(this.selectedOrganization.id)
			     .pipe(takeUntil(this._ngDestroy$))
			     .subscribe((data) => {
				    this.employeeLevels = data['items'];
			    });

		    this.store.selectedOrganization$
			    .pipe(takeUntil(this._ngDestroy$))
			    .subscribe((organization) => {
				    this.selectedOrganization = organization;
				    if (this.selectedOrganization) {
					    this.getPositions();
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

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		console.log(this.form);

		if (this.form.valid) {
			this.employeeStore.userForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(employee: Employee) {
		this.form = this.fb.group({
			username: [employee.user.username],
			email: [employee.user.email, Validators.required],
			firstName: [employee.user.firstName, Validators.required],
			lastName: [employee.user.lastName, Validators.required],
			imageUrl: [employee.user.imageUrl, Validators.required],
			employmentTypes: [['']],
			employeeLevel: [
				employee.user.employeeLevel || '',
				Validators.required
			],
			anonymousBonus: [employee.user['anonymousBonus']],
			organizationDepartment: [employee.organizationDepartment || null],
			organizationPosition: [employee.organizationPosition || null]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
