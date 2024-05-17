import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import {
	IEmployee,
	IOrganization,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	ITag,
	ISkill,
	IEmployeeLevel
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import { ckEditorConfig } from '@gauzy/ui-sdk/shared';
import {
	EmployeeLevelService,
	EmployeeStore,
	OrganizationDepartmentsService,
	OrganizationEmploymentTypesService,
	OrganizationPositionsService,
	Store,
	ToastrService
} from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-employment',
	templateUrl: './edit-employee-employment.component.html',
	styleUrls: ['./edit-employee-employment.component.scss']
})
export class EditEmployeeEmploymentComponent implements OnInit, OnDestroy {
	selectedEmployee: IEmployee;
	organization: IOrganization;
	employmentTypes: IOrganizationEmploymentType[] = [];
	employeeLevels: IEmployeeLevel[] = [];
	departments: IOrganizationDepartment[] = [];
	positions: IOrganizationPosition[] = [];
	ckConfig: CKEditor4.Config = {
		...ckEditorConfig,
		height: '200'
	};

	public form: UntypedFormGroup = EditEmployeeEmploymentComponent.buildForm(this.fb);
	/**
	 * Builds and returns an Angular UntypedFormGroup with various form controls.
	 *
	 * @param fb - An instance of Angular's UntypedFormBuilder, used to create form groups and form controls.
	 * @returns An UntypedFormGroup containing a collection of predefined form controls.
	 */
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		// Create a new form group with a collection of form controls, all initialized to empty arrays.
		const form = fb.group({
			organizationEmploymentTypes: [], // Employment types within an organization.
			employeeLevel: [], // Levels of employees.
			anonymousBonus: [], // Anonymous bonuses for employees.
			organizationDepartments: [], // Organization's departments.
			organizationPosition: [], // Positions within an organization.
			tags: [], // Tags for categorization.
			skills: [], // Skills required or obtained.
			short_description: [], // A brief description.
			description: [], // A detailed description.
			startedWorkOn: [] // Date when work started.
		});
		// Return the constructed form group.
		return form;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly employeeStore: EmployeeStore,
		private readonly employeeLevelService: EmployeeLevelService,
		private readonly organizationDepartmentsService: OrganizationDepartmentsService,
		private readonly organizationPositionsService: OrganizationPositionsService,
		private readonly organizationEmploymentTypeService: OrganizationEmploymentTypesService
	) {}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([organization, employee]) => !!organization && !!employee),
				distinctUntilChange(),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this._initializeForm(this.selectedEmployee)),
				tap(() => this.initialMethods()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initialMethods() {
		this.getPositions();
		this.getEmploymentTypes();
		this.getEmployeeLevels();
		this.getDepartments();
	}

	/**
	 * Fetches the list of departments for a given organization and tenant.
	 * Stores the retrieved departments in a class-level property.
	 */
	private async getDepartments(): Promise<void> {
		// Extract the organization ID and tenant ID from the class's organization property
		const { id: organizationId, tenantId } = this.organization;

		// Fetch departments using the organizationDepartmentsService with provided tenant and organization IDs
		const { items } = await this.organizationDepartmentsService.getAll([], {
			tenantId,
			organizationId
		});

		// Store the fetched list of departments in the class-level property
		this.departments = items;
	}

	/**
	 * Fetches the list of positions for a given organization and tenant.
	 * Stores the retrieved positions in a class-level property.
	 */
	private async getPositions(): Promise<void> {
		// Extract the organization ID and tenant ID from the class's organization property
		const { id: organizationId, tenantId } = this.organization;

		// Fetch positions from the organizationPositionsService with the given tenant and organization IDs
		const { items } = await this.organizationPositionsService.getAll({
			tenantId,
			organizationId
		});

		// Store the retrieved positions in the class-level property
		this.positions = items;
	}

	/**
	 * Fetches employment types for a given organization and tenant, and stores them in a class-level property.
	 */
	private getEmploymentTypes(): void {
		// Extract the organization ID and tenant ID from the class's organization property
		const { id: organizationId, tenantId } = this.organization;

		// Fetch employment types from the service and subscribe to the observable for asynchronous updates
		this.organizationEmploymentTypeService
			.getAll([], {
				tenantId,
				organizationId
			})
			.pipe(untilDestroyed(this)) // Ensure the subscription is destroyed when the component is destroyed
			.subscribe((types) => {
				// Store the fetched employment types in a class-level property
				this.employmentTypes = types.items;
			});
	}

	/**
	 * Fetches the employee levels for a given organization and tenant.
	 * Stores the retrieved employee levels in a class-level property.
	 */
	private async getEmployeeLevels(): Promise<void> {
		// Extract organizationId and tenantId from the organization object
		const { id: organizationId, tenantId } = this.organization;

		// Fetch employee levels using the employeeLevelService with provided tenant and organization IDs
		const { items } = await this.employeeLevelService.getAll([], {
			tenantId,
			organizationId
		});

		// Store the fetched employee levels in the class-level property
		this.employeeLevels = items;
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			const { id: organizationId } = this.organization;
			this.employeeStore.employeeForm = {
				...this.form.getRawValue(),
				organizationId
			};
		}
	}

	/**
	 * Handles the selection of tags and updates the form.
	 *
	 * @param tags - An array of ITag objects representing the selected tags.
	 */
	selectedTagsHandler(tags: ITag[]): void {
		// Update the 'tags' field in the form with the new array of tags
		this.form.get('tags').setValue(tags);
		// Ensure the form's validity is updated after changing the tags
		this.form.updateValueAndValidity();
	}

	/**
	 * Handles the selection of skills and updates the form.
	 *
	 * @param skills - An array of ISkill objects representing the selected skills.
	 */
	selectedSkillsHandler(skills: ISkill[]): void {
		// Update the 'skills' field in the form with the new array of skills
		this.form.get('skills').setValue(skills);
		// Ensure the form's validity is updated after changing the skills
		this.form.updateValueAndValidity();
	}

	/**
	 * Initializes the form with the given employee's data.
	 *
	 * @param employee - The employee object whose details are used to initialize the form.
	 */
	private _initializeForm(employee: IEmployee): void {
		// Apply the values from the employee object to the form, setting default values if the employee data is undefined
		this.form.patchValue({
			organizationEmploymentTypes: employee?.organizationEmploymentTypes || [], // Default to empty array
			organizationDepartments: employee?.organizationDepartments || [], // Default to empty array
			employeeLevel: employee?.employeeLevel, // Could be undefined or null
			anonymousBonus: employee?.anonymousBonus, // Could be undefined or null
			organizationPosition: employee?.organizationPosition || null, // Default to null
			tags: employee?.tags || [], // Default to empty array
			skills: employee?.skills || [], // Default to empty array
			short_description: employee?.short_description, // Could be undefined or null
			description: employee?.description, // Could be undefined or null
			startedWorkOn: employee?.startedWorkOn ? new Date(employee.startedWorkOn) : null // Converts to Date or null
		});
	}

	ngOnDestroy() {}
}
