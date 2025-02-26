import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Observable, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID } from '@gauzy/contracts';
import { EmployeeAppointmentService, ErrorHandlingService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy()
@Component({
    selector: 'ga-edit-appointment',
    templateUrl: './edit-appointment.component.html',
    standalone: false
})
export class EditAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading: boolean;
	public appointmentId$: Observable<ID>;

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
		// Create an observable for the appointment based on route parameters
		this.appointmentId$ = this._route.queryParams.pipe(
			// Ensure the route parameters are valid
			switchMap(({ token }) => {
				if (!token) {
					throw new Error('token missing');
				}
				return from(this._employeeAppointmentService.decodeToken(token));
			}),
			// Handle errors and redirect to 404 page
			catchError((error: any) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				// Redirect to 404 page
				this._router.navigate(['/share/404']);
				// Return an empty observable to maintain type consistency
				return EMPTY; // Return an empty observable to maintain type consistency
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	ngOnDestroy() {}
}
