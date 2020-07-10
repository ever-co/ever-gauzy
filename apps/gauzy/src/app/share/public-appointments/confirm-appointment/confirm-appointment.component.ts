import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EmployeesService } from '../../../@core/services';
import { takeUntil, first } from 'rxjs/operators';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';
import { Employee, EmployeeAppointment } from '@gauzy/models';
import * as moment from 'moment';
import { AlertModalComponent } from '../../../@shared/alert-modal/alert-modal.component';
import { NbDialogService } from '@nebular/theme';
@Component({
	templateUrl: './confirm-appointment.component.html'
})
export class ConfirmAppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading: boolean = true;
	employee: Employee;
	appointment: EmployeeAppointment;
	participants: string;
	duration: string;
	editLink: string;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private dialogService: NbDialogService,
		private employeeService: EmployeesService,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const appointmentId = params.appointmentId;
				const employeeId = params.id;
				if (employeeId && appointmentId) {
					this.loadAppointment(appointmentId, employeeId);
					const token = await this.employeeAppointmentService.signAppointmentId(
						appointmentId
					);
					this.editLink = `/share/employee/edit-appointment?token=${token}`;
					this.loading = false;
				} else {
					this.router.navigate(['/share/404']);
				}
			});
	}

	async loadAppointment(appointmentId: string, employeeId: string = '') {
		this.appointment = await this.employeeAppointmentService
			.getById(appointmentId)
			.pipe(first())
			.toPromise();

		if (employeeId) {
			this.employee = await this.employeeService.getEmployeeById(
				employeeId,
				['user']
			);
		}

		this.duration = `${moment(this.appointment.startDateTime).format(
			'llll'
		)} - ${moment(this.appointment.endDateTime).format('llll')}`;
	}

	async cancelAppointment(appointmentId: string) {
		const dialog = this.dialogService.open(AlertModalComponent, {
			context: {
				alertOptions: {
					title: 'Cancel Appointment',
					message: 'Are you sure? This action is irreversible.',
					status: 'danger'
				}
			}
		});
		const response = await dialog.onClose.pipe(first()).toPromise();
		if (!!response) {
			if (response === 'yes') {
				await this.employeeAppointmentService.update(appointmentId, {
					status: 'Cancelled'
				});
				this.loadAppointment(appointmentId);
			}
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
