import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { IEmployee, IImageAsset, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-sdk/common';
import { EmployeeStore } from '../../../../../@core/services';
import { ToastrService } from '@gauzy/ui-sdk/core';

/**
 * This component contains the properties stored within the User Entity of an Employee.
 * Any property which is either stored directly in the Employee entity or as a relation of the Employee entity should NOT be put in this Component
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-main',
	templateUrl: './edit-employee-main.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss',
		'./edit-employee-main.component.scss'
	]
})
export class EditEmployeeMainComponent implements OnInit, OnDestroy {
	organization: IOrganization;
	hoverState: boolean;
	selectedEmployee: IEmployee;

	/*
	 * Employee Main Mutation Form
	 */
	public form: UntypedFormGroup = EditEmployeeMainComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			username: [],
			email: [null, Validators.required],
			firstName: [],
			lastName: [],
			preferredLanguage: [],
			profile_link: [],
			imageId: [],
			imageUrl: [{ value: null, disabled: true }]
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly employeeStore: EmployeeStore
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this._initializeFormValue(this.selectedEmployee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	/**
	 * Upload employee image/avatar
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image) {
				this.employeeStore.userForm = {
					imageId: image.id
				};
			}
		} catch (error) {
			this.handleImageUploadError(error);
		}
	}

	/**
	 * Submit employee main profile
	 *
	 * @returns
	 */
	submitForm() {
		if (this.form.invalid || !this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const values = {
			organizationId,
			tenantId,
			...(this.form.valid ? this.form.value : {})
		};

		this.employeeStore.userForm = values;
		this.employeeStore.employeeForm = values;
	}

	private _initializeFormValue(employee: IEmployee) {
		this.form.patchValue({
			username: employee.user.username,
			email: employee.user.email,
			firstName: employee.user.firstName,
			lastName: employee.user.lastName,
			imageUrl: employee.user.imageUrl,
			imageId: employee.user.imageId,
			preferredLanguage: employee.user.preferredLanguage,
			profile_link: employee.profile_link
		});
	}

	ngOnDestroy() {}
}
