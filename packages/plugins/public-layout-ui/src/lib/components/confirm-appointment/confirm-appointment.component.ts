import { Component, OnInit, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router, ActivatedRoute, Params, UrlSerializer } from '@angular/router';
import { EMPTY, Observable, catchError, filter, firstValueFrom, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeeAppointmentStatus, ID, IEmployee, IEmployeeAppointment } from '@gauzy/contracts';
import { EmployeeAppointmentService, EmployeesService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { AlertModalComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-confirm-appointment',
    templateUrl: './confirm-appointment.component.html',
    providers: [EmployeeAppointmentService],
    standalone: false
})
export class ConfirmAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading: boolean = false;
	public employee: IEmployee;
	public employee$: Observable<IEmployee>;
	public appointment: IEmployeeAppointment;
	public appointment$: Observable<IEmployeeAppointment>;
	public participants: string;
	public duration: string;
	public rescheduleLink: string;

	constructor(
		readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _location: Location,
		private readonly _urlSerializer: UrlSerializer,
		private readonly _router: Router,
		private readonly _dialogService: NbDialogService,
		private readonly _employeeService: EmployeesService,
		private readonly _employeeAppointmentService: EmployeeAppointmentService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Create an observable for the employee based on route parameters
		this.appointment$ = this._route.params.pipe(
			// Ensure the route parameters are valid
			filter((params: Params) => !!params.appointmentId),
			// Fetch appointment from the employee appointment service
			switchMap((params: Params) => {
				// Get the appointment ID from the route parameters
				const appointmentId = params.appointmentId;
				// Fetch the employee appointment from the service
				return this._employeeAppointmentService.getById(appointmentId, ['employee', 'employee.user']);
			}),
			tap(async (appointment) => await this.getRescheduleLink(appointment)),
			// Handle errors
			catchError((error: any) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				// Redirect to 404 page
				this._router.navigate(['/share/404']);
				// Return an empty observable
				return EMPTY;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Get the reschedule link for the appointment.
	 *
	 * @param appointment The appointment to get the reschedule link for.
	 */
	async getRescheduleLink(appointment: IEmployeeAppointment): Promise<void> {
		// Get the appointment ID from the route parameters
		const appointmentId = appointment.id;
		// Get the start and end date time of the appointment
		const token = await this._employeeAppointmentService.signAppointmentId(appointmentId);
		// Get the URL to edit the appointment
		const urlTree = this._router.createUrlTree(['/share/employee/edit-appointment'], { queryParams: { token } });
		// As far as I can tell you don't really need the UrlSerializer.
		this.rescheduleLink = this._location.prepareExternalUrl(this._urlSerializer.serialize(urlTree));
	}

	/**
	 * Format the appointment duration.
	 *
	 * @param startDateTime The start time of the appointment.
	 * @param endDateTime The end time of the appointment.
	 * @returns A formatted string representing the duration.
	 */
	public formatDuration(startDateTime: Date, endDateTime: Date): string {
		const startFormatted = moment(startDateTime).format('llll');
		const endFormatted = moment(endDateTime).format('llll');
		return `${startFormatted} - ${endFormatted}`;
	}

	/**
	 * Cancel the appointment with a confirmation dialog.
	 *
	 * @param appointmentId The ID of the appointment to cancel.
	 */
	async cancelAppointment(appointmentId: ID) {
		const confirmed = await this.confirmCancellation();
		if (!confirmed) return;

		// Update the appointment status to 'Cancelled'
		await this._employeeAppointmentService.update(appointmentId, {
			status: EmployeeAppointmentStatus.CANCELLED
		});

		// Create an observable for the appointment
		const appointment = await firstValueFrom(
			this._employeeAppointmentService.getById(appointmentId, ['employee', 'employee.user'])
		);
		this.appointment$ = of(appointment);
	}

	/**
	 * Opens a confirmation dialog for cancelling an appointment.
	 *
	 * @returns A promise that resolves to true if the user confirms, otherwise false.
	 */
	private async confirmCancellation(): Promise<boolean> {
		// Open a confirmation dialog
		const dialog = this._dialogService.open(AlertModalComponent, {
			context: {
				data: {
					title: this.getTranslation('APPOINTMENTS_PAGE.CANCEL_APPOINTMENT'),
					message: this.getTranslation('APPOINTMENTS_PAGE.ARE_YOU_SURE'),
					status: 'danger'
				}
			}
		});

		// Wait for the user to confirm cancellation
		const response = await firstValueFrom(dialog.onClose);

		// Return true if the user confirmed cancellation, false otherwise
		return response === 'yes';
	}

	ngOnDestroy() {}
}
