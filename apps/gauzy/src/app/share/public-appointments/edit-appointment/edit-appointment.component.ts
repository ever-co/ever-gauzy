import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { of, tap } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID } from '@gauzy/contracts';
import { EmployeeAppointmentService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy()
@Component({
	selector: 'ga-edit-appointment',
	templateUrl: './edit-appointment.component.html'
})
export class EditAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading: boolean;
	public appointmentID: ID;

	constructor(
		readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _employeeAppointmentService: EmployeeAppointmentService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._route.queryParams
			.pipe(
				switchMap(async ({ token }) => {
					if (!token) {
						throw new Error('token missing');
					}
					return this._employeeAppointmentService.decodeToken(token);
				}),
				tap((appointmentID) => {
					this.appointmentID = appointmentID;
				}),
				catchError(async (error) => {
					this._errorHandlingService.handleError(error);
					await this._router.navigate(['/share/404']);
					return of(null); // Return an observable that emits `null` to avoid further processing
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}
}
