import { Component, OnInit } from '@angular/core';
import {
	EditEntityByMemberInput,
	Employee,
	OrganizationDepartment
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-employee-departments',
	templateUrl: './edit-employee-department.component.html'
})
export class EditEmployeeDepartmentComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationDepartments: OrganizationDepartment[] = [];
	employeeDepartments: OrganizationDepartment[] = [];

	selectedEmployee: Employee;

	constructor(
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly toastrService: NbToastrService,
		private readonly employeeStore: EmployeeStore,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.selectedEmployee = emp;
				if (this.selectedEmployee) {
					this.loadDepartments();
				}
			});
	}

	async submitForm(formInput: EditEntityByMemberInput, removed: boolean) {
		try {
			if (formInput.member) {
				await this.organizationDepartmentsService.updateByEmployee(
					formInput
				);
				this.loadDepartments();
				this.toastrService.primary(
					this.getTranslation(
						removed
							? 'TOASTR.MESSAGE.EMPLOYEE_DEPARTMENT_REMOVED'
							: 'TOASTR.MESSAGE.EMPLOYEE_DEPARTMENT_ADDED'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	private async loadDepartments() {
		await this.loadSelectedEmployeeDepartments();
		const orgDepartments = await this.getOrganizationDepartments();
		const selectedDepartmentIds = this.employeeDepartments.map((d) => d.id);
		this.organizationDepartments = orgDepartments.filter(
			(dep) => selectedDepartmentIds.indexOf(dep.id) < 0
		);
	}

	private async loadSelectedEmployeeDepartments() {
		if (!this.selectedEmployee) {
			return;
		}

		this.employeeDepartments = await this.organizationDepartmentsService.getAllByEmployee(
			this.selectedEmployee.id
		);
	}

	private async getOrganizationDepartments() {
		if (!this.selectedEmployee.orgId) {
			return;
		}

		const res = await this.organizationDepartmentsService.getAll([], {
			organizationId: this.selectedEmployee.orgId
		});

		return res ? res.items : [];
	}
}
