import { Component, OnInit } from '@angular/core';
import {
	EditEntityByMemberInput,
	Employee,
	OrganizationContact
} from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';
import { OrganizationContactService } from '../../../../../@core/services/organization-contact.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-employee-departments',
	templateUrl: './edit-employee-contact.component.html'
})
export class EditEmployeeContactComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();

	organizationContact: OrganizationContact[] = [];
	employeeContact: OrganizationContact[] = [];

	selectedEmployee: Employee;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
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
				await this.organizationContactService.updateByEmployee(
					formInput
				);
				this.loadDepartments();
				this.toastrService.primary(
					this.getTranslation(
						removed
							? 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_REMOVED'
							: 'TOASTR.MESSAGE.EMPLOYEE_CLIENT_ADDED'
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
		const selectedDepartmentIds = this.employeeContact.map((d) => d.id);
		this.organizationContact = orgDepartments.filter(
			(dep) => selectedDepartmentIds.indexOf(dep.id) < 0
		);
	}

	private async loadSelectedEmployeeDepartments() {
		if (!this.selectedEmployee) {
			return;
		}

		this.employeeContact = await this.organizationContactService.getAllByEmployee(
			this.selectedEmployee.id
		);
	}

	private async getOrganizationDepartments() {
		if (!this.selectedEmployee.orgId) {
			return;
		}

		const res = await this.organizationContactService.getAll([], {
			organizationId: this.selectedEmployee.orgId
		});

		return res ? res.items : [];
	}
}
