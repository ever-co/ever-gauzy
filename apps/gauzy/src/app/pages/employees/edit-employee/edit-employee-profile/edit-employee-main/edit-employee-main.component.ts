import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { EmployeeStore, Store, ToastrService } from '../../../../../@core/services';

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
	public form: FormGroup = EditEmployeeMainComponent.buildForm(this.fb);
	static buildForm(
		fb: FormBuilder
	): FormGroup {
		return fb.group({
			username: [],
			email: [null, Validators.required],
			firstName: [],
			lastName: [],
			imageUrl: ['', Validators.required],
			preferredLanguage: [],
			profile_link: []
		});
	}

	constructor(
		private readonly fb: FormBuilder,
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

	updateImage(imageUrl: string) {
		this.form.get('imageUrl').setValue(imageUrl);
		try  {
			this.employeeStore.userForm = {
				imageUrl
			};
		} catch (error) {
			this.handleImageUploadError(error)
		}
	}

	submitForm() {
		if (this.form.valid) {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;
			
			const values = {
				...this.form.getRawValue(),
				...{
					organizationId,
					tenantId
				}
			}

			this.employeeStore.userForm = values;
			this.employeeStore.employeeForm = values;
		}
	}

	private _initializeFormValue(employee: IEmployee) {
		this.form.patchValue({
			username: employee.user.username,
			email: employee.user.email,
			firstName: employee.user.firstName,
			lastName: employee.user.lastName,
			imageUrl: employee.user.imageUrl,
			preferredLanguage: employee.user.preferredLanguage,
			profile_link: employee.profile_link
		});
	}

	ngOnDestroy() {}
}
