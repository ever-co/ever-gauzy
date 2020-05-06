import {
	Component,
	ViewChild,
	OnDestroy,
	OnInit,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { EmployeeAppointmentService } from '../../../../@core/services/employee-appointment.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Router } from '@angular/router';
import { Employee, EmployeeAppointment } from '@gauzy/models';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { EmployeesService } from '../../../../@core/services';
import { NbToastrService } from '@nebular/theme';

@Component({
	templateUrl: './manage-appointment.component.html'
})
export class ManageAppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	employees: Employee[];
	@Input() employeeAppointment: EmployeeAppointment;

	@ViewChild('start_time', { static: false })
	@Output()
	save = new EventEmitter<EmployeeAppointment>();
	@Output() cancel = new EventEmitter<string>();

	invitees: Employee[];

	constructor(
		private router: Router,
		private fb: FormBuilder,
		private employeeService: EmployeesService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._initializeForm();
		this._loadEmployees();
	}

	private _initializeForm() {
		this.form = this.fb.group({
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
			selectedRange: { start: null, end: null }
		});
	}

	private _loadEmployees() {
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employees) => {
				this.employees = employees.items;
			});
	}

	async onSaveRequest() {
		const employeeAppointmentRequest = {
			agenda: this.form.get('agenda').value,
			location: this.form.get('location').value,
			description: this.form.get('description').value,
			invitees: this.invitees,
			startDateTime: this.form.get('selectedRange').value.start,
			endDateTime: this.form.get('selectedRange').value.end
		};

		if (this.employeeAppointment) {
			employeeAppointmentRequest['id'] = this.employeeAppointment.id;
		}

		if (!employeeAppointmentRequest['id']) {
			this.employeeAppointment = await this.employeeAppointmentService.create(
				employeeAppointmentRequest
			);
		} else {
			this.employeeAppointment = await this.employeeAppointmentService.update(
				employeeAppointmentRequest
			);
		}

		this.toastrService.primary(this.getTranslation('TOASTR.TITLE.SUCCESS'));
		this.router.navigate(['/pages/employees/appointments']);
	}

	onMembersSelected(ev) {
		this.invitees = ev;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
