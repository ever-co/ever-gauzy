import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import { RolesEnum, Employee } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';

@Component({
	selector: 'ga-employee-mutation',
	templateUrl: 'employee-mutation.component.html',
	styleUrls: ['employee-mutation.component.scss']
})
export class EmployeeMutationComponent implements OnInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;

	constructor(
		protected dialogRef: NbDialogRef<EmployeeMutationComponent>,
		protected organizationsService: OrganizationsService,
		protected employeesService: EmployeesService,
		protected toastrService: NbToastrService,
		protected store: Store,
		private errorHandler: ErrorHandlingService
	) {}

	ngOnInit(): void {
		console.warn('EmployeeMutationComponent');
	}

	closeDialog(employee: Employee = null) {
		this.dialogRef.close(employee);
	}

	async add() {
		try {
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.EMPLOYEE
			);
			const organization = this.store.selectedOrganization;

			const newEmployee = {
				user,
				organization,
				...this.userBasicInfo.form.value
			};

			const employee = await this.employeesService
				.create(newEmployee)
				.pipe(first())
				.toPromise();

			this.closeDialog(employee);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
}
