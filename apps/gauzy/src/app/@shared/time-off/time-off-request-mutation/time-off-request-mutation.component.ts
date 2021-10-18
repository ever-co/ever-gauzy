import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
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
import { isNotEmpty } from '@gauzy/common-angular';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import {
	EmployeesService,
	OrganizationDocumentsService,
	Store,
	TimeOffService,
} from '../../../@core/services';
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
		private readonly timeOffService: TimeOffService,
		private readonly employeesService: EmployeesService,
		private readonly documentsService: OrganizationDocumentsService,
		private readonly store: Store
	) {}

	/**
	 * Employee Selector
	 */
	employeeSelector: EmployeeSelectorComponent;
	@ViewChild('employeeSelector') set content(component: EmployeeSelectorComponent) {
		if (component) {
			this.employeeSelector = component;
		}
	}

	@Input() type: string;

	/*
	* Getter & Setter
	*/
	_timeOff: ITimeOff;
	get timeOff(): ITimeOff {
		return this._timeOff;
	}
	@Input() set timeOff(value: ITimeOff) {
		this._timeOff = value;
	};

	policies: ITimeOffPolicy[] = [];
	employeesArr: IEmployee[] = [];
	selectedEmployee: any;
	policy: ITimeOffPolicy;
	isEditMode = false;
	minDate = new Date(moment().format('YYYY-MM-DD'));
	public organization: IOrganization;
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
				filter((organization: IOrganization) => !!organization),
				debounceTime(200),
				tap((organization) => this.organization = organization),
				tap(() => this._getPolicies()),
				tap(() => this.patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Patch form value on edit section 
	 */
	patchFormValue() {
		// patch form value
		if(this.timeOff) {
			this.form.patchValue({
				start: this.timeOff.start,
				end: this.timeOff.end,
				description: this.timeOff.description,
				policy: this.timeOff.policy,
				status: this.timeOff.status,
				documentUrl: this.timeOff.documentUrl
			});
			
			this.policy = this.timeOff.policy;
			this.selectedEmployee = this.timeOff['employees'][0];
			this.employeesArr = this.timeOff['employees'];
		}		
	}

	saveRequest() {
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
			.subscribe(({ items }) => {
				if (isNotEmpty(items)) {
					let downloadDocUrl: string; 
					if (reqType === 'paid') {
						downloadDocUrl = items[0].documentUrl;
					} else {
						downloadDocUrl = items[1].documentUrl;
					}
					window.open(`${downloadDocUrl}`);
				}
			});
	}

	private _createNewRecord() {
		if (this.form.invalid) {
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
					isHoliday: false,
					requestDate: new Date()
				},
				this.form.getRawValue()
			)
		);
	}

	private _checkFormData() {
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

	private _getPolicies() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.timeOffService.getAllPolicies(['employees'], {
			organizationId,
			tenantId
		})
		.pipe(
			first(),
			tap(({ items }) => this.policies = items)
		)
		.subscribe();
	}

	onPolicySelected(policy: ITimeOffPolicy) {
		this.policy = policy;
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
