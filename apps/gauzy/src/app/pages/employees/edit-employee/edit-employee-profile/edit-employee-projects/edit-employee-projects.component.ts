import { Component, OnInit } from '@angular/core';
import {
	EditEntityByMemberInput,
	Employee,
	OrganizationProjects
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-employee-departments',
	templateUrl: './edit-employee-projects.component.html'
})
export class EditEmployeeProjectsComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationProjects: OrganizationProjects[] = [];
	employeeProjects: OrganizationProjects[] = [];

	selectedEmployee: Employee;

	constructor(
		private readonly organizationProjectsService: OrganizationProjectsService,
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
				await this.organizationProjectsService.updateByEmployee(
					formInput
				);
				this.loadDepartments();
				this.toastrService.primary(
					this.getTranslation(
						removed
							? 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_REMOVED'
							: 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_ADDED'
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
		const selectedDepartmentIds = this.employeeProjects.map((d) => d.id);
		this.organizationProjects = orgDepartments.filter(
			(dep) => selectedDepartmentIds.indexOf(dep.id) < 0
		);
	}

	private async loadSelectedEmployeeDepartments() {
		if (!this.selectedEmployee) {
			return;
		}

		this.employeeProjects = await this.organizationProjectsService.getAllByEmployee(
			this.selectedEmployee.id
		);
	}

	private async getOrganizationDepartments() {
		if (!this.selectedEmployee.orgId) {
			return;
		}

		const res = await this.organizationProjectsService.getAll([], {
			organizationId: this.selectedEmployee.orgId
		});

		return res ? res.items : [];
	}
}
