import { Component, OnInit } from '@angular/core';
import { NbDateService, NbDialogRef } from '@nebular/theme';
import * as Holidays from 'date-holidays';
import { IEmployee, ITimeOffPolicy, IOrganization, StatusTypesEnum, IUser } from '@gauzy/contracts';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import moment from 'moment';
import { CompareDateValidator, EmployeesService, ToastrService } from '@gauzy/ui-sdk/core';
import { Store, distinctUntilChange } from '@gauzy/ui-sdk/common';
import { environment as ENV } from '@gauzy/ui-config';
import { FormHelpers } from '../../forms/helpers';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-off-holiday-mutation',
	templateUrl: './time-off-holiday-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffHolidayMutationComponent implements OnInit {
	FormHelpers: typeof FormHelpers = FormHelpers;

	constructor(
		protected readonly dialogRef: NbDialogRef<TimeOffHolidayMutationComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly dateService: NbDateService<Date>
	) {
		this.minDate = this.dateService.addMonth(this.dateService.today(), 0);
	}

	orgEmployees: IEmployee[] = [];
	employeesArr: IEmployee[] = [];
	holidays = [];
	minDate: Date;
	public organization: IOrganization;
	countryCode: string;
	employeeIds: string[] = [];

	/*
	 * Time Off Holiday Mutation Form
	 */
	public form: UntypedFormGroup = TimeOffHolidayMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		const form = fb.group(
			{
				start: ['', Validators.required],
				end: ['', Validators.required],
				policy: ['', Validators.required],
				policyId: ['', Validators.required],
				status: [],
				description: []
			},
			{
				validators: [CompareDateValidator.validateDate('start', 'end')]
			}
		);
		return form;
	}

	ngOnInit() {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user.employee),
				tap(({ employee: { contact } }: IUser) => {
					if (contact && contact.country) {
						this.countryCode = contact.country;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(({ contact }: IOrganization) => {
					if (contact && contact.country) {
						this.countryCode = contact.country;
					}
				}),
				tap(() => this._getFormData()),
				tap(() => this._getOrganizationEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async _getAllHolidays() {
		const holidays = new Holidays();
		const countryCode = this.countryCode || ENV.DEFAULT_COUNTRY;
		if (countryCode) {
			holidays.init(countryCode);
			this.holidays = holidays.getHolidays(moment().year()).filter((holiday) => holiday.type === 'public');
		} else {
			this.toastrService.danger('TOASTR.MESSAGE.HOLIDAY_ERROR');
		}
	}

	saveHoliday() {
		this.employeeIds.forEach((element) => {
			const employee = this.orgEmployees.find((e) => e.id === element);
			this.employeesArr.push(employee);
		});
		this._createNewRecord();
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
					isHoliday: true,
					requestDate: new Date()
				},
				this.form.getRawValue()
			)
		);
	}

	private async _getFormData() {
		this._getAllHolidays();
	}

	private _getOrganizationEmployees() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.employeesService
			.getAll(['user', 'tags'], {
				organizationId,
				tenantId
			})
			.pipe(
				first(),
				tap(({ items }) => (this.orgEmployees = items))
			)
			.subscribe();
	}

	onPolicySelected(policy: ITimeOffPolicy) {
		this.form.get('policy').setValue(policy);
		if (policy.requiresApproval) {
			this.form.get('status').setValue(StatusTypesEnum.REQUESTED);
		} else {
			this.form.get('status').setValue(StatusTypesEnum.APPROVED);
		}
		this.form.updateValueAndValidity();
	}

	onEmployeesSelected(employees: string[]) {
		this.employeeIds = employees;
	}

	/**
	 * Patch value on holiday selected
	 *
	 * @param holiday
	 */
	onHolidaySelected(holiday: any) {
		this.form.patchValue({
			start: holiday.start,
			end: holiday.end || null,
			description: holiday.name
		});
	}

	close() {
		this.dialogRef.close();
	}
}
