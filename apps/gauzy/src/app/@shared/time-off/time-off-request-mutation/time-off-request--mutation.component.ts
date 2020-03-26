import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Employee, TimeOffPolicy } from '@gauzy/models';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { TimeOffService } from '../../../@core/services/time-off.service';

@Component({
	selector: 'ngx-time-off-request-mutation',
	templateUrl: './time-off-request-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffRequestMutationComponent implements OnInit, OnDestroy {
	constructor(
		protected dialogRef: NbDialogRef<TimeOffRequestMutationComponent>,
		private timeOffService: TimeOffService,
		private store: Store
	) {}

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;
	policies: TimeOffPolicy[] = [];

	employees: Employee[];
	organizationId: string;
	description: string;
	policy: TimeOffPolicy;
	start: Date;
	end: Date;
	requestDate: Date;
	status: string;
	holidayName: string;

	ngOnInit() {
		this.getFormData();
		this.initializeForm();
	}

	private async initializeForm() {}

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
			items.map((item) => this.policies.push(item));
			this.policy = this.policies[items.length - 1];
		}
	}

	onPolicySelected(policy: TimeOffPolicy) {
		this.policy = policy;
	}

	addRequest() {}

	close() {
		this.dialogRef.close();
	}

	ngOnDestroy() {}
}
