import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import * as Holidays from 'date-holidays';
import {
	IEmployee,
	ITimeOffPolicy,
	ITimeOff,
	IOrganization,
	StatusTypesEnum
} from '@gauzy/contracts';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import {
	EmployeesService,
	OrganizationDocumentsService,
	OrganizationsService,
	Store,
	TimeOffService,
	ToastrService
} from '../../../@core/services';
import { environment as ENV } from './../../../../environments/environment';
import { CompareDateValidator } from '../../../@core/validators';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-off-request-mutation',
	templateUrl: './time-off-request-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffRequestMutationComponent implements OnInit {
	constructor(
		protected readonly dialogRef: NbDialogRef<TimeOffRequestMutationComponent>,
		private readonly fb: FormBuilder,
		private readonly toastrService: ToastrService,
		private readonly timeOffService: TimeOffService,
		private readonly employeesService: EmployeesService,
		private readonly documentsService: OrganizationDocumentsService,
		private readonly store: Store,
		private readonly organizationService: OrganizationsService
	) {}

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;

	@Input() type: ITimeOff | string;

	policies: ITimeOffPolicy[] = [];
	orgEmployees: IEmployee[] = [];
	employeesArr: IEmployee[] = [];
	holidays = [];
	selectedEmployee: any;
	documentUrl: any;
	description = '';
	downloadDocUrl = '';
	uploadDocUrl = '';
	status: string;
	holidayName: string;
	policy: ITimeOffPolicy;
	startDate: Date = null;
	endDate: Date = null;
	requestDate: Date;
	invalidInterval: boolean;
	isHoliday = false;
	isEditMode = false;
	minDate = new Date(moment().format('YYYY-MM-DD'));
	public organization: IOrganization;
	organizationCountryCode: string;
	currentUserCountryCode: string;
	employeeIds: string[] = [];

	/*
	* Time Off Request Mutation Form 
	*/
	public form: FormGroup = TimeOffRequestMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		const form = fb.group({
			description: [],
			start: ['', Validators.required],
			end: ['', Validators.required],
			policy: ['', Validators.required],
			requestDate: [new Date()],
			documentUrl: [],
			status: []
		}, { 
			validators: [
				CompareDateValidator.validateDate('start', 'end')
			]
		});
		return form;
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				debounceTime(200),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._initializeForm()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _getAllHolidays() {
		const holidays = new Holidays();
		const countryCode = this.organizationCountryCode || this.currentUserCountryCode || ENV.DEFAULT_COUNTRY;

		if (countryCode) {
			holidays.init(countryCode);
			this.holidays = holidays
				.getHolidays(moment().year())
				.filter((holiday) => holiday.type === 'public');
		} else {
			this.toastrService.danger('TOASTR.MESSAGE.HOLIDAY_ERROR');
		}
	}

	private async _initializeForm() {
		await this._getFormData();
		this.setForm();
	}

	setForm() {
		this.form.patchValue({
			description: this.description,
			start: this.startDate,
			end: this.endDate,
			policy: this.policy,
			documentUrl: this.uploadDocUrl,
			status: ''
		});
		this.documentUrl = this.form.get('documentUrl');
	}

	addRequest() {
		this.selectedEmployee = this.employeeSelector.selectedEmployee;

		this._checkFormData();

		if (this.selectedEmployee.id) {
			this.employeesArr.push(this.selectedEmployee);
			this._createNewRecord();
		}
	}

	getRequestForm(reqType: string) {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.documentsService
			.getAll({ tenantId, organizationId })
			.pipe(first())
			.subscribe((docs) => {
				if (reqType === 'paid') {
					this.downloadDocUrl = docs.items[0].documentUrl;
				} else {
					this.downloadDocUrl = docs.items[1].documentUrl;
				}

				window.open(`${this.downloadDocUrl}`);
			});
	}

	addHolidays() {
		this._checkFormData();
		this.employeeIds.forEach((element) => {
			const employee = this.orgEmployees.find((e) => e.id === element);
			this.employeesArr.push(employee);
		});
		this._createNewRecord();
	}

	private _createNewRecord() {
		if (this.form.invalid && this.invalidInterval) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.dialogRef.close(
			Object.assign(
				{
					employees: this.employeesArr,
					organizationId,
					tenantId,
					isHoliday: this.isHoliday
				},
				this.form.value
			)
		);

		this.invalidInterval = false;
	}

	private _checkFormData() {
		const { start, end, requestDate } = this.form.value;

		if (start > end || requestDate > start) {
			this.invalidInterval = true;
			this.toastrService.danger('TOASTR.MESSAGE.INTERVAL_ERROR');
		}

		if (this.policy.requiresApproval) {
			this.form.patchValue({
				status: StatusTypesEnum.REQUESTED
			});
		} else {
			this.form.patchValue({
				status: StatusTypesEnum.APPROVED
			});
		}
	}

	private async _getFormData() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.organizationService.getAll(['contact'], {
			id: organizationId,
			tenantId
		});
		this.organization = items[0];

		if (this.organization.contact) {
			this.organizationCountryCode = this.organization.contact.country;
		}

		if (this.store.user.employeeId) {
			this.employeesService
				.getEmployeeById(this.store.user.employeeId, ['contact'])
				.then((data) => {
					if (data.contact) {
						this.currentUserCountryCode = data.contact.country;
					}
				});
		}

		if (this.type === 'holiday') {
			this.isHoliday = true;
			this._getAllHolidays();
		} else if (this.type.hasOwnProperty('id')) {
			this.isEditMode = true;
			this.selectedEmployee = this.type['employees'][0];
			this.policy = this.type['policy'];
			this.startDate = this.type['start'];
			this.endDate = this.type['end'];
			this.description = this.type['description'];
			this.employeesArr = this.type['employees'];
		}

		this._getPolicies();
		this._getOrganizationEmployees();
	}

	private _getPolicies() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.timeOffService
			.getAllPolicies(['employees'], {
				organizationId,
				tenantId
			})
			.pipe(first())
			.subscribe(({ items }) => {
				this.policies = items;
				this.policy = items[0];
			});
	}

	private _getOrganizationEmployees() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeesService.getAll(['user', 'tags'], {
			organizationId,
			tenantId
		})
		.pipe(first())
		.subscribe((res) => (this.orgEmployees = res.items));
	}

	onPolicySelected(policy: ITimeOffPolicy) {
		this.policy = policy;
	}

	onEmployeesSelected(employees: string[]) {
		this.employeeIds = employees;
	}

	onHolidaySelected(holiday) {
		this.startDate = holiday.start;
		this.endDate = holiday.end || null;
		this.description = holiday.name;

		this.setForm();
	}

	close() {
		this.dialogRef.close();
	}

	/**
	 * Form invalid control validate
	 * 
	 * @param control 
	 * @returns 
	 */
	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && 
			this.form.get(control).invalid;
	}
}
