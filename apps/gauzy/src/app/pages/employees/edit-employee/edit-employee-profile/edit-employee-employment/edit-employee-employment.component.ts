import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Params } from '@angular/router';
import {
	IEmployee,
	IOrganization,
	IOrganizationDepartment,
	IOrganizationEmploymentType,
	IOrganizationPosition,
	ITag,
	ISkill
} from '@gauzy/contracts';
import { EmployeeLevelService } from 'apps/gauzy/src/app/@core/services/employee-level.service';
import { OrganizationDepartmentsService } from 'apps/gauzy/src/app/@core/services/organization-departments.service';
import { OrganizationEmploymentTypesService } from 'apps/gauzy/src/app/@core/services/organization-employment-types.service';
import { OrganizationPositionsService } from 'apps/gauzy/src/app/@core/services/organization-positions';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeeStore } from '../../../../../@core/services/employee-store.service';

@Component({
	selector: 'ga-edit-employee-employment',
	templateUrl: './edit-employee-employment.component.html',
	styleUrls: ['./edit-employee-employment.component.scss']
})
export class EditEmployeeEmploymentComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedEmployee: IEmployee;
	fakeDepartments: { departmentName: string; departmentId: string }[] = [];
	fakePositions: { positionName: string; positionId: string }[] = [];
	employmentTypes: IOrganizationEmploymentType[];
	employeeLevels: { level: string; organizationId: string }[] = [];
	selectedOrganization: IOrganization;
	departments: IOrganizationDepartment[] = [];
	positions: IOrganizationPosition[] = [];
	tags: ITag[] = [];
	skills: ISkill[] = [];
	selectedTags: any;

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
		this.employeeStore.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (emp) => {
				this.selectedEmployee = emp;
				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
						if (this.selectedOrganization) {
							this.getPositions();
							this.getEmploymentTypes();
							this.getEmployeeLevels();
							this.getDepartments();
						}
					});

				if (this.selectedEmployee) {
					this._initializeForm(this.selectedEmployee);
				}
			});
	}

	private async getDepartments() {
		const { items } = await this.organizationDepartmentsService.getAll([], {
			organizationId: this.selectedOrganization.id,
			tenantId: this.selectedOrganization.tenantId
		});
		this.departments = items;
	}

	private async getPositions() {
		const { items } = await this.organizationPositionsService.getAll({
			organizationId: this.selectedOrganization.id,
			tenantId: this.selectedOrganization.tenantId
		});
		this.positions = items;
	}

	private getEmploymentTypes() {
		this.organizationEmploymentTypeService
			.getAll([], {
				organizationId: this.selectedOrganization.id,
				tenantId: this.selectedOrganization.tenantId
			})
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((types) => {
				this.employmentTypes = types.items;
			});
	}

	private async getEmployeeLevels() {
		const { items } = await this.employeeLevelService.getAll(
			this.selectedOrganization.id,
			[],
			{ tenantId: this.selectedOrganization.tenantId }
		);
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
	}

	selectedSkillsHandler(currentSelection: ISkill[]) {
		this.form.get('skills').setValue(currentSelection);
	}

	private _initializeForm(employee: IEmployee) {
		this.form = this.fb.group({
			organizationEmploymentTypes: [
				employee.organizationEmploymentTypes || null
			],

			employeeLevel: [employee.employeeLevel || ''],
			anonymousBonus: [employee.anonymousBonus],
			organizationDepartments: [employee.organizationDepartments || null],
			organizationPosition: [employee.organizationPosition || null],
			tags: [employee.tags],
			skills: [employee.skills],
			short_description: employee.short_description,
			description: employee.description,
			startedWorkOn: [
				employee.startedWorkOn !== null
					? new Date(employee.startedWorkOn)
					: ''
			]
		});

		this.tags = this.form.get('tags').value || [];
		this.skills = this.form.get('skills').value || [];
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
