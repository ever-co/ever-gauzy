import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { BasicInfoFormComponent } from '../../user/forms/basic-info/basic-info-form.component';
import { RolesEnum, Employee } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'ga-employee-mutation',
	templateUrl: 'employee-mutation.component.html',
	styleUrls: ['employee-mutation.component.scss']
})
export class EmployeeMutationComponent implements OnInit, AfterViewInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;

	form: FormGroup;

	constructor(
		protected dialogRef: NbDialogRef<EmployeeMutationComponent>,
		protected organizationsService: OrganizationsService,
		protected employeesService: EmployeesService,
		protected toastrService: NbToastrService,
		protected store: Store,
		private errorHandler: ErrorHandlingService
	) {}

	ngOnInit(): void {}

	ngAfterViewInit() {
		this.form = this.userBasicInfo.form;
	}

	closeDialog(employee: Employee = null) {
		this.dialogRef.close(employee);
	}

	async add() {
		try {
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.EMPLOYEE
			);

			const tags = this.userBasicInfo.selectedTags;
			const organization = this.store.selectedOrganization;
			const offerDate = this.form.get('offerDate').value || null;
			const acceptDate = this.form.get('acceptDate').value || null;
			const rejectDate = this.form.get('rejectDate').value || null;

			const newEmployee = {
				user,
				organization,
				offerDate,
				acceptDate,
				rejectDate,
				tags
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
