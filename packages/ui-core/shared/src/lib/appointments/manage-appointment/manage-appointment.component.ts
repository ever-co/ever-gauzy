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
import { filter, switchMap } from 'rxjs/operators';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IEmployeeAppointment, IAvailabilitySlot, ID, EmployeeAppointmentStatus } from '@gauzy/contracts';
import {
	AppointmentEmployeesService,
	AvailabilitySlotsService,
	EmployeeAppointmentService,
	EmployeesService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeeScheduleComponent } from '../employee-schedules/employee-schedule.component';
import { EmployeeSelectComponent } from '../../employee/employee-multi-select/employee-multi-select.component';
import { AlertModalComponent } from '../../components/alert-modal/alert-modal.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-manage-appointment',
	templateUrl: './manage-appointment.component.html',
	styleUrls: ['./manage-appointment.component.scss'],
	providers: [AppointmentEmployeesService, AvailabilitySlotsService, EmployeeAppointmentService]
})
export class ManageAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	form: UntypedFormGroup;
	employees: IEmployee[] = [];

	@Input() employee: IEmployee;
	@Input() employeeAppointment: IEmployeeAppointment;
	@Input() disabled: boolean;
	@Input() appointmentId: ID;
	@Input() allowedDuration: number;
	@Input() hidePrivateFields = false;
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
	editMode: boolean;

	@Input() selectedRange: { start: Date; end: Date };

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectComponent;

	constructor(
		readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _fb: UntypedFormBuilder,
		private readonly _store: Store,
		private readonly _dialogService: NbDialogService,
		private readonly _employeeService: EmployeesService,
		private readonly _employeeAppointmentService: EmployeeAppointmentService,
		private readonly _appointmentEmployeesService: AppointmentEmployeesService,
		private readonly _availabilitySlotsService: AvailabilitySlotsService,
		private readonly _toastrService: ToastrService,
		private readonly _cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit(): void {
		if (this.selectedRange) {
			this.start = this.selectedRange.start;
			this.end = this.selectedRange.end;
		} else {
			this._route.queryParams.subscribe((params) => {
				this.selectedRange = {
					start: this.convertToDate(params?.dateStart),
					end: this.convertToDate(params?.dateEnd)
				};
				this.timezone = this.timezone || params.timezone || timezone.tz.guess();
			});
		}

		this.timezoneOffset = timezone.tz(this.timezone).format('Z');
		timezone.tz.setDefault(this.timezone);

		this._store.selectedOrganization$
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

		this._route.params
			.pipe(
				switchMap(async (params) => {
					if (!params.employeeId) return;

					try {
						// Get employee by ID
						this.employee = await firstValueFrom(
							this._employeeService.getEmployeeById(params.employeeId, ['user'])
						);
					} catch (error) {
						console.log('Error while loading employee', error);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._initializeForm();
	}

	ngAfterViewInit() {
		this._cdr.detectChanges();
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
		this.form = this._fb.group({
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
		const { tenantId } = this._store.user;
		const organizationId = this._selectedOrganizationId;

		this.employees = (
			await firstValueFrom(
				this._employeeService
					.getAll(['user'], {
						tenantId,
						organizationId
					})
					.pipe(untilDestroyed(this))
			)
		).items;
	}

	private _parseParams() {
		this._route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			const id = params.appointmentId || this.appointmentId;
			if (id) {
				this.editMode = true;
				const appointment = await firstValueFrom(this._employeeAppointmentService.getById(id));
				const selectedEmployees = await firstValueFrom(
					this._appointmentEmployeesService.getById(appointment.id).pipe(untilDestroyed(this))
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
			const dialog = this._dialogService.open(AlertModalComponent, {
				context: {
					data: {
						title: this.getTranslation('APPOINTMENTS_PAGE.CANCEL_APPOINTMENT'),
						message: this.getTranslation('APPOINTMENTS_PAGE.ARE_YOU_SURE'),
						status: 'danger'
					}
				}
			});
			const response = await firstValueFrom(dialog.onClose);
			if (response === 'yes') {
				await this._employeeAppointmentService.update(this.employeeAppointment.id, {
					status: EmployeeAppointmentStatus.CANCELLED
				});
				this._toastrService.success('APPOINTMENTS_PAGE.CANCEL_SUCCESS');
				history.back();
			}
		} catch (error) {
			this._toastrService.danger(
				this.getTranslation('APPOINTMENTS_PAGE.CANCEL_FAIL'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async fetchAvailabilitySlotsForAllEmployees() {
		const { tenantId } = this._store.user;
		const slots = (
			await this._availabilitySlotsService.getAll([], {
				organizationId: this._selectedOrganizationId,
				tenantId
			})
		).items;

		this.employees = this.employees.filter(
			(e) =>
				e.id !==
				(this.employee
					? this.employee.id
					: this._store.selectedEmployee
					? this._store.selectedEmployee.id
					: null)
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
			if (this._store.user) {
				tenantId = this._store.user.tenantId;
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
					: this._store.selectedEmployee
					? this._store.selectedEmployee.id
					: null,
				organizationId: this._selectedOrganizationId,
				tenantId
			};

			if (!this.employeeAppointment) {
				this.employeeAppointment = await this._employeeAppointmentService.create(employeeAppointmentRequest);
			} else {
				await this._employeeAppointmentService.update(this.employeeAppointment.id, employeeAppointmentRequest);

				// Removing all previously selected employee ids
				for (const id of this.selectedEmployeeAppointmentIds) {
					await this._appointmentEmployeesService.delete(id);
				}
			}

			for (const e of this.selectedEmployeeIds) {
				await this._appointmentEmployeesService.add({
					employeeId: e,
					appointmentId: this.employeeAppointment.id,
					employeeAppointment: this.employeeAppointment
				});
			}

			this._toastrService.success('APPOINTMENTS_PAGE.SAVE_SUCCESS');
			if (this.employee) {
				this._router.navigate([`/share/employee/${this.employee.id}/confirm/${this.employeeAppointment.id}`]);
			} else {
				this._router.navigate(['/pages/employees/appointments']);
			}
		} catch (error) {
			this._toastrService.danger('APPOINTMENTS_PAGE.SAVE_FAILED');
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
				const dialog = this._dialogService.open(EmployeeScheduleComponent, {
					context: {
						schedule: {
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

	private convertToDate(dateString: string): Date | null {
		const date = moment(dateString);
		if (date.isValid()) {
			return date.toDate();
		} else {
			return null;
		}
	}

	ngOnDestroy() {}
}
