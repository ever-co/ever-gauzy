import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Employee, TimeOffPolicy } from '@gauzy/models';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '../../../@core/services/store.service';
import { TimeOffService } from '../../../@core/services/time-off.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ngx-time-off-request-mutation',
	templateUrl: './time-off-request-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffRequestMutationComponent implements OnInit {
	constructor(
		protected dialogRef: NbDialogRef<TimeOffRequestMutationComponent>,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private timeOffService: TimeOffService,
		private employeesService: EmployeesService,
		private store: Store
	) {}

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	@Input() type: string;

	form: FormGroup;
	policies: TimeOffPolicy[] = [];
	orgEmployees: Employee[];
	employeesArr: Employee[] = [];
	selectedEmployee: any;
	organizationId: string;
	policy: TimeOffPolicy;
	requestDate: Date;
	status: string;
	holidayName: string;
	invalidInterval: boolean;
	isHoliday: boolean;
	holidays = ['Christmas', 'Easter'];
	description = '';

	ngOnInit() {
		if (this.type === 'holiday') {
			this.isHoliday = true;
		}

		this._initializeForm();
	}

	private async _initializeForm() {
		await this._getFormData();

		this.form = this.fb.group({
			description: [this.description],
			start: ['', Validators.required],
			end: ['', Validators.required],
			policy: [this.policy, Validators.required],
			requestDate: [new Date()],
			status: ['']
		});
	}

	addRequest() {
		this.selectedEmployee = this.employeeSelector.selectedEmployee;

		this._checkFormData();

		if (this.selectedEmployee.id) {
			this.employeesArr.push(this.selectedEmployee);
			this._createNewRecord();
		}
	}

	addHolidays() {
		this._checkFormData();
		this._createNewRecord();
	}

	private _createNewRecord() {
		if (this.form.valid && !this.invalidInterval) {
			this.dialogRef.close(
				Object.assign(
					{
						employees: this.employeesArr,
						organizationId: this.organizationId
					},
					this.form.value
				)
			);
		}

		this.invalidInterval = false;
	}

	private _checkFormData() {
		const { start, end, requestDate } = this.form.value;

		if (start > end || requestDate > start) {
			this.invalidInterval = true;
			this.toastrService.danger(
				'Please pick correct dates and try again',
				'Invalid days off interval'
			);
		}

		if (this.policy.requiresApproval) {
			this.form.value.status = 'Requested';
		} else {
			this.form.value.status = 'Approved';
		}
	}

	private async _getFormData() {
		this.organizationId = this.store.selectedOrganization.id;

		this._getPolicies();
		this._getOrganizationEmployees();
	}

	private _getPolicies() {
		if (this.organizationId) {
			const findObj: {} = {
				organization: {
					id: this.organizationId
				}
			};

			this.timeOffService
				.getAllPolicies(['employees'], findObj)
				.pipe(first())
				.subscribe((res) => {
					this.policies = res.items;
					this.policy = this.policies[res.items.length - 1];
				});
		}
	}

	private async _getOrganizationEmployees() {
		if (!this.organizationId) {
			return;
		}

		const { items } = await this.employeesService
			.getAll(['user', 'tags'], {
				organization: { id: this.organizationId }
			})
			.pipe(first())
			.toPromise();

		this.orgEmployees = items;
	}

	onPolicySelected(policy: TimeOffPolicy) {
		this.policy = policy;
	}

	onEmployeesSelected(employees: Employee[]) {
		this.employeesArr = employees;
	}

	onHolidaySelected(holiday: string) {
		this.description = holiday;
	}

	close() {
		this.dialogRef.close();
	}
}
