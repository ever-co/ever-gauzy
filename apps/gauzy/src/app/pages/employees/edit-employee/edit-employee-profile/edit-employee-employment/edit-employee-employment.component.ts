import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
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
import { distinctUntilChange } from '@gauzy/common-angular';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	EmployeeLevelService,
	EmployeeStore,
	OrganizationDepartmentsService,
	OrganizationEmploymentTypesService,
	OrganizationPositionsService,
	Store,
	ToastrService
} from './../../../../../@core/services';
import { ckEditorConfig } from "../../../../../@shared/ckeditor.config";

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
	ckConfig: any = {
		...ckEditorConfig,
		height: "200"
	};
	
	static buildForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			organizationEmploymentTypes: [],
			employeeLevel: [],
			anonymousBonus: [],
			organizationDepartments: [],
			organizationPosition: [],
			tags: [],
			skills: [],
			short_description: [],
			description: [],
			startedWorkOn: []
		});
		return form;
	}
	public form: FormGroup = EditEmployeeEmploymentComponent.buildForm(this.fb);


	constructor(
		private readonly fb: FormBuilder,
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
				filter(([organization]) => !!organization),
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

	private async getDepartments() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.organizationDepartmentsService.getAll([], { 
			tenantId,
			organizationId
		});
		this.departments = items;
	}

	private async getPositions() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.organizationPositionsService.getAll({ 
			tenantId,
			organizationId
		});
		this.positions = items;
	}

	private getEmploymentTypes() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.organizationEmploymentTypeService
			.getAll([], { 
				tenantId,
				organizationId
			})
			.pipe(untilDestroyed(this))
			.subscribe((types) => {
				this.employmentTypes = types.items;
			});
	}

	private async getEmployeeLevels() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { items } = await this.employeeLevelService.getAll([], { 
			tenantId,
			organizationId
		});
		this.employeeLevels = items;
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			this.employeeStore.employeeForm = {
				...this.form.value
			};
		}
	}

	selectedTagsHandler(currentSelection: ITag[]) {
		this.form.get('tags').setValue(currentSelection);
		this.form.updateValueAndValidity();
	}

	selectedSkillsHandler(currentSelection: ISkill[]) {
		this.form.get('skills').setValue(currentSelection);
		this.form.updateValueAndValidity();
	}

	private _initializeForm(employee: IEmployee) {
		this.form.patchValue({
			organizationEmploymentTypes: employee.organizationEmploymentTypes,
			organizationDepartments: employee.organizationDepartments,
			employeeLevel: employee.employeeLevel,
			anonymousBonus: employee.anonymousBonus,
			organizationPosition: employee.organizationPosition,
			tags: employee.tags,
			skills: employee.skills,
			short_description: employee.short_description,
			description: employee.description,
			startedWorkOn: employee.startedWorkOn ? new Date(employee.startedWorkOn) : null
		});
	}

	ngOnDestroy() {}
}
