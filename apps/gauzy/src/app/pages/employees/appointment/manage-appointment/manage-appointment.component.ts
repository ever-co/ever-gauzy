import {
	Component,
	OnDestroy,
	OnInit,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { EmployeeAppointmentService } from '../../../../@core/services/employee-appointment.service';
import {
	FormGroup,
	FormBuilder,
	Validators,
	AbstractControl
} from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Router, ActivatedRoute } from '@angular/router';
import { Employee, EmployeeAppointment } from '@gauzy/models';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { EmployeesService } from '../../../../@core/services';
import { NbToastrService } from '@nebular/theme';
import { AppointmentEmployeesService } from 'apps/gauzy/src/app/@core/services/appointment-employees.service';
import * as moment from 'moment';
import { Store } from '../../../../@core/services/store.service';

@Component({
	selector: 'ga-manage-appointment',
	templateUrl: './manage-appointment.component.html',
	styleUrls: ['./manage-appointment.component.scss']
})
export class ManageAppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	employees: Employee[];
	@Input() employee: Employee;
	@Input() employeeAppointment: EmployeeAppointment;
	@Input() disabled: boolean;
	@Input() allowedDuration: number;
	@Input() hidePrivateFields: boolean = false;

	@Output() save = new EventEmitter<EmployeeAppointment>();
	@Output() cancel = new EventEmitter<string>();

	selectedEmployeeIds: string[];
	emailAddresses: any[] = [];
	emails: any;
	start: Date;
	end: Date;

	@Input('selectedRange')
	selectedRange: { start: Date; end: Date };

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private fb: FormBuilder,
		private store: Store,
		private employeeService: EmployeesService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private appointmentEmployeesService: AppointmentEmployeesService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		if (this.selectedRange) {
			this.start = this.selectedRange.start;
			this.end = this.selectedRange.end;
		}
		this._parseParams();
		this._loadEmployees();
	}

	EmailListValidator(
		control: AbstractControl
	): { [key: string]: boolean } | null {
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
			emails: [
				'',
				Validators.compose([
					Validators.required,
					this.EmailListValidator
				])
			],
			agenda: [
				this.employeeAppointment ? this.employeeAppointment.agenda : '',
				Validators.required
			],
			location: [
				this.employeeAppointment
					? this.employeeAppointment.location
					: ''
			],
			description: [
				this.employeeAppointment
					? this.employeeAppointment.description
					: ''
			],
			invitees: [
				this.employeeAppointment
					? this.employeeAppointment.invitees
					: [],
				Validators.required
			],
			selectedRange: this.selectedRange,
			bufferTime:
				this.employeeAppointment &&
				this.employeeAppointment.bufferTimeInMins
					? true
					: false,
			breakTime:
				this.employeeAppointment &&
				this.employeeAppointment.breakTimeInMins
					? true
					: false,
			bufferTimeStart:
				this.employeeAppointment &&
				this.employeeAppointment.bufferTimeStart,
			bufferTimeEnd:
				this.employeeAppointment &&
				this.employeeAppointment.bufferTimeEnd,
			bufferTimeInMins:
				this.employeeAppointment &&
				this.employeeAppointment.bufferTimeInMins,
			breakTimeInMins:
				this.employeeAppointment &&
				this.employeeAppointment.breakTimeInMins,
			breakStartTime:
				this.employeeAppointment &&
				this.employeeAppointment.breakStartTime
		});

		this.emails = this.form.get('emails');
	}

	private _loadEmployees() {
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
	}

	private _parseParams() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;
				if (id) {
					const appointment = await this.employeeAppointmentService
						.getById(id)
						.pipe(first())
						.toPromise();

					const selectedEmployees = await this.appointmentEmployeesService
						.getById(appointment.id)
						.pipe(takeUntil(this._ngDestroy$))
						.toPromise();

					this.selectedEmployeeIds = selectedEmployees.map(
						(o) => o.employeeId
					);
					this.selectedRange = {
						start: new Date(appointment.startDateTime),
						end: new Date(appointment.endDateTime)
					};
					this.start = this.selectedRange.start;
					this.end = this.selectedRange.end;
					this.employeeAppointment = appointment;
				}
				this._initializeForm();
			});
	}

	async onSaveRequest() {
		const employeeAppointmentRequest = {
			emails: this.emails.value,
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
				moment(this.form.get('selectedRange').value.start).format(
					'YYYY-MM-DD'
				) +
					' ' +
					this.form.get('breakStartTime').value
			),
			employeeId: this.employee
				? this.employee.id
				: this.store.selectedEmployee
				? this.store.selectedEmployee.id
				: null
		};

		if (this.employeeAppointment) {
			employeeAppointmentRequest['id'] = this.employeeAppointment.id;
		}

		if (!employeeAppointmentRequest['id']) {
			this.employeeAppointment = await this.employeeAppointmentService.create(
				employeeAppointmentRequest
			);

			if (this.selectedEmployeeIds) {
				for (let e of this.selectedEmployeeIds) {
					await this.appointmentEmployeesService.add({
						employeeId: e,
						appointmentId: this.employeeAppointment.id
					});
				}
			}
		} else {
			this.employeeAppointment = await this.employeeAppointmentService.update(
				employeeAppointmentRequest
			);
		}

		this.toastrService.primary(this.getTranslation('TOASTR.TITLE.SUCCESS'));
		this.employee
			? this.router.navigate([
					`/share/employee/${this.employee.id}/confirm/${this.employeeAppointment.id}`
			  ])
			: this.router.navigate(['/pages/employees/appointments']);
	}

	onMembersSelected(ev) {
		this.selectedEmployeeIds = ev;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
