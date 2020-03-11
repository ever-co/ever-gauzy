import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { EmployeesService } from '../../../../../@core/services/employees.service';
import { TranslateService } from '@ngx-translate/core';
import {
	Employee,
	Organization,
	EmploymentTypesCreateInput
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { OrganizationEmpTypesService } from '../../../../../@core/services/organization-emp-types.service';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-emptypes',
	templateUrl: './edit-organization-employmentTypes.component.html'
})
export class EditOrganizationEmploymentTypes extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	showAddCard: boolean;
	selectedEmployee: Employee;
	organization: Organization;
	empTypes: EmploymentTypesCreateInput[];

	constructor(
		private fb: FormBuilder,
		private employeeService: EmployeesService,
		private readonly toastrService: NbToastrService,
		private organizationEditStore: OrganizationEditStore,
		private organizationEmpTypesService: OrganizationEmpTypesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._initializeForm();
		this.organizationEditStore.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.organization = data;
				if (this.organization) {
					this.employeeService
						.getEmpTypes(this.organization.id)
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe((types) => {
							this.empTypes = types;
						});
				}
			});
	}

	private _initializeForm() {
		this.form = this.fb.group({
			name: ['', Validators.required]
		});
	}

	private async onKeyEnter($event) {
		if ($event.code === 'Enter') {
			this.addEmploymentType($event.target.value);
		}
	}

	private async addEmploymentType(name: string) {
		if (name) {
			const newEmpType = {
				name,
				organizationId: this.organization.id
			};
			this.employeeService
				.addEmpType(newEmpType)
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((data) => {
					this.empTypes.push(data);
				});
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.ADD_EMPLOYMENT_TYPE',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.showAddCard = !this.showAddCard;
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.INVALID_EMPLOYMENT_TYPE'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_INVALID_EMPLOYMENT_TYPE'
				)
			);
		}
	}

	submitForm() {
		const name = this.form.controls['name'].value;
		const newEmpType = {
			name,
			organizationId: this.organization.id
		};
		this.employeeService
			.addEmpType(newEmpType)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((data) => {
				this.empTypes.push(data);
			});
		this.form.reset();
	}

	async delType(id, name) {
		await this.organizationEmpTypesService.deleteEmploymentType(id);
		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYMENT_TYPES.DELETE_EMPLOYMENT_TYPE',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.empTypes = this.empTypes.filter((t) => t['id'] !== id);
	}

	async update(empType) {
		await this.organizationEmpTypesService.update(empType);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
