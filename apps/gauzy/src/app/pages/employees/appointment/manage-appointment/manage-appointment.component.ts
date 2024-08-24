import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	Output,
	EventEmitter,
	ViewChild,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { IEmployee, IEmployeeAppointment, IAvailabilitySlot } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	EmployeesService,
	ToastrService
} from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AlertModalComponent, EmployeeSelectComponent } from '@gauzy/ui-core/shared';
import { EmployeeSchedulesComponent } from '../employee-schedules/employee-schedules.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manage-appointment',
	templateUrl: './manage-appointment.component.html',
	styleUrls: ['./manage-appointment.component.scss']
})
export class ManageAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	form: UntypedFormGroup;
	employees: IEmployee[];
	@Input() employee: IEmployee;
	@Input() employeeAppointment: IEmployeeAppointment;
	@Input() disabled: boolean;
	@Input() appointmentID: string;
	@Input() allowedDuration: number;
	@Input() hidePrivateFields: boolean = false;
	@Input() timezone: string;

	@Output() save = new EventEmitter<IEmployeeAppointment>();
	@Output() cancel = new EventEmitter<string>();

	timezoneOffset: string;
	employeeAvailability: object = {};
	selectedEmployeeIds: string[] = [];
	selectedEmployeeAppointmentIds: string[] = [];
	emailAddresses: any[] = [];
	_selectedOrganizationId: string;
	tenantId: string;
	emails: any;
	start: Date;
	end: Date;
	editMode: Boolean;

	@Input() selectedRange: { start: Date; end: Date };

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectComponent;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private fb: UntypedFormBuilder,
		private store: Store,
		private dialogService: NbDialogService,
		private employeeService: EmployeesService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private appointmentEmployeesService: AppointmentEmployeesService,
		private availabilitySlotsService: AvailabilitySlotsService,
		private toastrService: ToastrService,
		readonly translateService: TranslateService,
		private cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		if (this.selectedRange) {
			this.start = this.selectedRange.start;
			this.end = this.selectedRange.end;
		} else {
			this.selectedRange = {
				start: history.state.dateStart,
				end: history.state.dateEnd
			};
		}

		this.timezone = this.timezone || history.state.timezone || timezone.tz.guess();
		this.timezoneOffset = timezone.tz(this.timezone).format('Z');
		timezone.tz.setDefault(this.timezone);

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
					await this._loadEmployees().then(() => this._parseParams());
				}
			});

		this._initializeForm();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
	}

	private _patchFormValue() {
		this.form.patchValue({
			emails: this.employeeAppointment.emails
				? this.employeeAppointment.emails.split(', ').map((o) => ({ emailAddress: o }))
				: '',
			agenda: this.employeeAppointment.agenda,
			location: this.employeeAppointment.location,
			description: this.employeeAppointment.description,
			invitees: this.employeeAppointment.invitees,
			selectedRange: this.selectedRange,
			bufferTime: this.employeeAppointment.bufferTimeInMins ? true : false,
			breakTime: this.employeeAppointment.breakTimeInMins ? true : false,
			bufferTimeStart: this.employeeAppointment.bufferTimeStart,
			bufferTimeEnd: this.employeeAppointment.bufferTimeEnd,
			bufferTimeInMins: this.employeeAppointment.bufferTimeInMins,
			breakTimeInMins: this.employeeAppointment.breakTimeInMins,
			breakStartTime: this.employeeAppointment.breakStartTime
		});
		this.emails = this.form.get('emails');
	}

	emailListValidator(control: AbstractControl): { [key: string]: boolean } | null {
		const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
		const invalid = (control.value || []).find((tag) => {
			return !emailPattern.test(tag.emailAddress || '');
		});
		return invalid ? { emails: invalid } : null;
	}

	addTagFn(emailAddress) {
		return { emailAddress: emailAddress, tag: true };
	}

	private _initializeForm() {
		this.form = this.fb.group({
			emails: ['', Validators.compose([Validators.required, this.emailListValidator])],
			agenda: ['', Validators.required],
			location: [''],
			description: [''],
			invitees: [{ value: [] }, Validators.required],
			selectedRange: this.selectedRange,
			bufferTime: [],
			breakTime: [],
			bufferTimeStart: [''],
			bufferTimeEnd: [''],
			bufferTimeInMins: [''],
			breakTimeInMins: [''],
			breakStartTime: ['']
		});
		this.emails = this.form.get('emails');
	}

	private async _loadEmployees() {
		const { tenantId } = this.store.user;
		const organizationId = this._selectedOrganizationId;

		this.employees = (
			await firstValueFrom(
				this.employeeService
					.getAll(['user'], {
						tenantId,
						organizationId
					})
					.pipe(untilDestroyed(this))
			)
		).items;
	}

	private _parseParams() {
		this.route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			const id = params.appointmentId || this.appointmentID;
			if (id) {
				this.editMode = true;
				const appointment = await firstValueFrom(this.employeeAppointmentService.getById(id));
				const selectedEmployees = await firstValueFrom(
					this.appointmentEmployeesService.getById(appointment.id).pipe(untilDestroyed(this))
				);
				this.selectedEmployeeIds = selectedEmployees.map((o) => o.employeeId);
				this.selectedEmployeeAppointmentIds = selectedEmployees.map((o) => o.id);
				this.start = new Date(appointment.startDateTime);
				this.end = new Date(appointment.endDateTime);
				if (!this.selectedRange.start) {
					this.selectedRange = {
						start: this.start,
						end: this.end
					};
				}
				this.employeeAppointment = appointment;
				this._patchFormValue();
			}

			this.fetchAvailabilitySlotsForAllEmployees();
		});
	}

	async cancelAppointment() {
		try {
			const dialog = this.dialogService.open(AlertModalComponent, {
				context: {
					data: {
						title: this.getTranslation('APPOINTMENTS_PAGE.CANCEL_APPOINTMENT'),
						message: this.getTranslation('APPOINTMENTS_PAGE.ARE_YOU_SURE'),
						status: 'danger'
					}
				}
			});
			const response = await firstValueFrom(dialog.onClose);
			if (!!response) {
				if (response === 'yes') {
					await this.employeeAppointmentService.update(this.employeeAppointment.id, {
						status: 'Cancelled'
					});
					this.toastrService.success('APPOINTMENTS_PAGE.CANCEL_SUCCESS');
					history.back();
				}
			}
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('APPOINTMENTS_PAGE.CANCEL_FAIL'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async fetchAvailabilitySlotsForAllEmployees() {
		const { tenantId } = this.store.user;
		const slots = (
			await this.availabilitySlotsService.getAll([], {
				organizationId: this._selectedOrganizationId,
				tenantId
			})
		).items;

		this.employees = this.employees.filter(
			(e) =>
				e.id !==
				(this.employee ? this.employee.id : this.store.selectedEmployee ? this.store.selectedEmployee.id : null)
		);

		this.employees.map((e) => {
			const dateSpecificSlots: IAvailabilitySlot[] = [];
			const recurringSlots: IAvailabilitySlot[] = [];

			slots.forEach((s) => {
				if (s.employeeId === e.id && s.type === 'Recurring') {
					recurringSlots.push(s);
				} else if (s.employeeId === e.id) {
					dateSpecificSlots.push(s);
				}
			});

			this.employeeAvailability[e.id] = dateSpecificSlots.filter(
				(s) =>
					s.employeeId === e.id &&
					moment(this.selectedRange.start).isBetween(moment(s.startTime), moment(s.endTime), 'day', '[]')
			);

			if (this.employeeAvailability[e.id].length === 0) {
				const appointmentDay = moment(this.selectedRange.start).format('dddd');
				this.employeeAvailability[e.id] = recurringSlots.filter(
					(s) => moment(s.startTime).format('dddd') === appointmentDay
				);
			}
		});
	}

	async onSaveRequest() {
		try {
			let tenantId = null;
			if (this.store.user) {
				tenantId = this.store.user.tenantId;
			}

			const employeeAppointmentRequest = {
				emails: this.emails.value && this.emails.value.map((email) => email.emailAddress).join(', '),
				agenda: this.form.get('agenda').value,
				location: this.form.get('location').value,
				description: this.form.get('description').value,
				startDateTime: this.form.get('selectedRange').value.start,
				endDateTime: this.form.get('selectedRange').value.end,
				bufferTimeStart: this.form.get('bufferTimeStart').value,
				bufferTimeEnd: this.form.get('bufferTimeEnd').value,
				bufferTimeInMins: this.form.get('bufferTimeInMins').value,
				breakTimeInMins: this.form.get('breakTimeInMins').value,
				breakStartTime: new Date(
					moment(this.form.get('selectedRange').value.start).format('YYYY-MM-DD') +
						' ' +
						this.form.get('breakStartTime').value
				),
				employeeId: this.employee
					? this.employee.id
					: this.store.selectedEmployee
					? this.store.selectedEmployee.id
					: null,
				organizationId: this._selectedOrganizationId,
				tenantId
			};

			if (!this.employeeAppointment) {
				this.employeeAppointment = await this.employeeAppointmentService.create(employeeAppointmentRequest);
			} else {
				await this.employeeAppointmentService.update(this.employeeAppointment.id, employeeAppointmentRequest);

				// Removing all previously selected employee ids
				for (const id of this.selectedEmployeeAppointmentIds) {
					await this.appointmentEmployeesService.delete(id);
				}
			}

			for (const e of this.selectedEmployeeIds) {
				await this.appointmentEmployeesService.add({
					employeeId: e,
					appointmentId: this.employeeAppointment.id,
					employeeAppointment: this.employeeAppointment
				});
			}

			this.toastrService.success('APPOINTMENTS_PAGE.SAVE_SUCCESS');
			this.employee
				? this.router.navigate([`/share/employee/${this.employee.id}/confirm/${this.employeeAppointment.id}`])
				: this.router.navigate(['/pages/employees/appointments']);
		} catch (error) {
			this.toastrService.danger('APPOINTMENTS_PAGE.SAVE_FAILED');
		}
	}

	async onMembersSelected(ev) {
		const startDateTime = this.form.get('selectedRange').value.start;
		const endDateTime = this.form.get('selectedRange').value.end;
		const added = ev.find((o) => !this.selectedEmployeeIds.includes(o));

		if (added) {
			const slots: IAvailabilitySlot[] = this.employeeAvailability[added];
			const slotInSelectedRange = slots.find(
				(s) =>
					moment(startDateTime).isBetween(moment(s.startTime), moment(s.endTime), 'minutes', '[]') &&
					moment(endDateTime).isBetween(moment(s.startTime), moment(s.endTime), 'minutes', '[]')
			);

			if ((slots.length > 0 && !slotInSelectedRange) || slots.length === 0) {
				const dialog = this.dialogService.open(EmployeeSchedulesComponent, {
					context: {
						employeeSchedule: {
							employeeName: this.employees.find((o) => o.id === added).user.name,
							slots,
							timezone: this.timezone
						}
					}
				});

				const response = await firstValueFrom(dialog.onClose);

				if (response !== 'yes') {
					this.employeeSelector.employeeId = ev.filter((o) => o !== added);
					return;
				}
			}
		}

		this.selectedEmployeeIds = ev;
	}

	ngOnDestroy() {}
}
