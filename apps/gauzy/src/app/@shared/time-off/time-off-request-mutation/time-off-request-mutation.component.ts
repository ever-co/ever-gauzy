import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import * as Holidays from 'date-holidays';
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
	startDate: Date = null;
	endDate: Date = null;
	requestDate: Date;
	status: string;
	holidayName: string;
	invalidInterval: boolean;
	isHoliday = false;
	holidays = [];
	description = '';

	ngOnInit() {
		if (this.type === 'holiday') {
			this.isHoliday = true;
			this._getAllHolidays();
		}

		this._initializeForm();
	}

	private async _getAllHolidays() {
		const holidays = new Holidays();
		const currentMoment = new Date;

		fetch('https://extreme-ip-lookup.com/json/')
			.then( res => res.json())
			.then(response => {
				holidays.init(response.countryCode);
				this.holidays = holidays.getHolidays(currentMoment.getFullYear()).filter(holiday => holiday.type === 'public');
			})
			.catch(() => {
				this.toastrService.danger('Unable to get holidays')
			})
		
	}

	private async _initializeForm() {
		await this._getFormData();

		this.form = this.fb.group({
			description: [this.description],
			start: [this.startDate, Validators.required],
			end: [this.endDate, Validators.required],
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
						organizationId: this.organizationId,
						isHoliday: this.isHoliday
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

	private _getOrganizationEmployees() {
		if (!this.organizationId) {
			return;
		}

		this.employeesService
			.getAll(['user', 'tags'], {
				organization: { id: this.organizationId }
			})
			.pipe(first())
			.subscribe((res) => this.orgEmployees = res.items)
	}

	onPolicySelected(policy: TimeOffPolicy) {
		this.policy = policy;
	}

	onEmployeesSelected(employees: Employee[]) {
		this.employeesArr = employees;
	}

	onHolidaySelected(holiday) {
		this.startDate = holiday.start;
		this.endDate = holiday.end || null;
		this.description = holiday.name;
		this._initializeForm();
	}

	close() {
		this.dialogRef.close();
	}
}
