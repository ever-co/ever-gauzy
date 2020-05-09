import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import { Employee, Organization, PreferredLanguageEnum } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';

/**
 * This component contains the properties stored within the User Entity of an Employee.
 * Any property which is either stored directly in the Employee entity or as a relation of the Employee entity should NOT be put in this Component
 */
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
	languages: string[] = Object.values(PreferredLanguageEnum);

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (emp) => {
				this.selectedEmployee = emp;

				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
				}

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
					});
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
		this.form = this.fb.group({
			username: [employee.user.username],
			email: [employee.user.email, Validators.required],
			firstName: [employee.user.firstName],
			lastName: [employee.user.lastName],
			imageUrl: [employee.user.imageUrl, Validators.required],
			preferredLanguage: [employee.user.preferredLanguage]
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
