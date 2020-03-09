import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { EmployeesService } from '../../../../../@core/services/employees.service';
import { TranslateService } from '@ngx-translate/core';
import {
	Employee,
	Organization,
	EmployeeTypesCreateInput
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { OrganizationEmpTypesService } from '../../../../../@core/services/organization-emp-types.service';
import { NbToastrService } from '@nebular/theme';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

@Component({
	selector: 'ga-edit-org-emptypes',
	templateUrl: './edit-organization-employeeTypes.component.html'
})
export class EditOrganizationEmployeeTypes extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	showAddCard: boolean;
	selectedEmployee: Employee;
	organization: Organization;
	empTypes: EmployeeTypesCreateInput[];

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

	private async addEmployeeType(name: string) {
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
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_TYPE.ADD_EMPLOYEE_TYPE',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			// this.loadPositions();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EMPLOYEE_TYPE.INVALID_EMPLOYEE_TYPE'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_INVALID_EMPLOYEE_TYPE'
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

	delType(id) {
		this.organizationEmpTypesService
			.delType(id)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe();
		this.empTypes = this.empTypes.filter((t) => t['id'] !== id);
	}

	update(empType) {
		this.organizationEmpTypesService
			.update(empType)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
