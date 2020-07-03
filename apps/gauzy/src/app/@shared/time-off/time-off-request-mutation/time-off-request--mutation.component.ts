import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Employee, TimeOffPolicy } from '@gauzy/models';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
	selector: 'ngx-time-off-request-mutation',
	templateUrl: './time-off-request-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffRequestMutationComponent implements OnInit, OnDestroy {
	constructor(
		protected dialogRef: NbDialogRef<TimeOffRequestMutationComponent>,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private timeOffService: TimeOffService,
		private store: Store
	) {}

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	form: FormGroup;
	policies: TimeOffPolicy[] = [];
	employees: Employee[];
	selectedEmployee: any;
	organizationId: string;
	policy: TimeOffPolicy;
	requestDate: Date;
	status: string;
	holidayName: string;
	invalidInterval: boolean;

	ngOnInit() {
		this.getFormData();
		this.initializeForm();
	}

	async getFormData() {
		this.organizationId = this.store.selectedOrganization.id;

		if (this.organizationId) {
			const findObj: {} = {
				organization: {
					id: this.organizationId
				}
			};

			const { items } = await this.timeOffService.getAllPolicies(
				['employees'],
				findObj
			);
			items.forEach((item) => this.policies.push(item));
			this.policy = this.policies[items.length - 1];
		}
	}

	private async initializeForm() {
		this.form = this.fb.group({
			description: [''],
			start: ['', Validators.required],
			end: ['', Validators.required],
			policy: [this.policy, Validators.required],
			requestDate: [new Date()]
		});
	}

	onPolicySelected(policy: TimeOffPolicy) {
		this.policy = policy;
	}

	addRequest() {
		this.selectedEmployee = this.employeeSelector.selectedEmployee;
		const { start, end } = this.form.value;

		if (start >= end) {
			this.invalidInterval = true;
			this.toastrService.danger(
				'Please pick correct dates and try again',
				'Invalid days off interval'
			);
		}

		if (
			this.form.valid &&
			this.selectedEmployee.id &&
			!this.invalidInterval
		) {
			this.dialogRef.close(
				Object.assign(
					{ employee: this.selectedEmployee },
					this.form.value
				)
			);
		}

		this.invalidInterval = false;
	}

	close() {
		this.dialogRef.close();
	}

	ngOnDestroy() {}
}
