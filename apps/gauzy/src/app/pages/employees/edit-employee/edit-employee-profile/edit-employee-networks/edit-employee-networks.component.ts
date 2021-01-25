import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { EmployeesService } from 'apps/gauzy/src/app/@core/services';
import { EmployeeStore } from 'apps/gauzy/src/app/@core/services/employee-store.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { patterns } from 'apps/gauzy/src/app/@shared/regex/regex-patterns.const';

@Component({
	selector: 'ga-edit-employee-networks',
	templateUrl: './edit-employee-networks.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditEmployeeNetworksComponent implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	selectedEmployee: IEmployee;
	selectedOrganization: IOrganization;

	constructor(
		private fb: FormBuilder,
		private readonly store: Store,
		private readonly employeeStore: EmployeeStore,
		private readonly employeesService: EmployeesService
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

	private _initializeForm(employee: IEmployee) {
		this.form = this.fb.group({
			linkedInUrl: [
				employee.linkedInUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			facebookUrl: [
				employee.facebookUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			instagramUrl: [
				employee.instagramUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			twitterUrl: [
				employee.twitterUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			githubUrl: [
				employee.githubUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			gitlabUrl: [
				employee.gitlabUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			],
			upworkUrl: [
				employee.upworkUrl,
				Validators.compose([
					Validators.pattern(new RegExp(patterns.websiteUrl))
				])
			]
		});
	}

	async submitForm() {
		await this.employeesService.update(
			this.selectedEmployee.id,
			this.form.value
		);
	}
}
