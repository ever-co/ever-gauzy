import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { EmployeesService } from '../../../../../@core/services/employees.service';
import {
	Employee,
	Organization,
	EmployeeTypesCreateInput
} from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { OrganizationEditStore } from '../../../../../@core/services/organization-edit-store.service';
import { OrganizationEmpTypesService } from '../../../../../@core/services/organization-emp-types.service';

@Component({
	selector: 'ga-edit-org-emptypes',
	templateUrl: './edit-organization-employeeTypes.component.html'
})
export class EditOrganizationEmployeeTypes implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: Employee;
	organization: Organization;
	empTypes: EmployeeTypesCreateInput[];

	constructor(
		private fb: FormBuilder,
		private employeeService: EmployeesService,
		private organizationEditStore: OrganizationEditStore,
		private organizationEmpTypesService: OrganizationEmpTypesService
	) {}

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
