import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Observable, catchError, filter, of, switchMap, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IEmployee, IEventType } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeesService, ErrorHandlingService, EventTypeService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
    templateUrl: './create-appointment.component.html',
    styleUrls: ['../public-appointment/public-appointment.component.scss'],
    providers: [EventTypeService],
    standalone: false
})
export class CreateAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public employee$: Observable<IEmployee | null>;
	public employee: IEmployee;
	public eventType: IEventType;
	public eventType$: Observable<IEventType | null>;
	public loading: boolean = true;
	public appointmentFormURL: string;

	constructor(
		readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _employeeService: EmployeesService,
		private readonly _eventTypeService: EventTypeService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.employee$ = this._route.params.pipe(
			// Ensure the route parameters are valid
			filter((params: Params) => !!params.id),
			// Fetch the employee from the employee service
			switchMap((params: Params) => this._employeeService.getEmployeeById(params.id, ['user'])),
			// Store the employee in the 'employee' property
			tap((employee: IEmployee) => (this.employee = employee)),
			// Handle errors
			catchError((error: any) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				// Navigate to the 404 page
				this._router.navigate(['/share/404']);
				// Return null to avoid breaking the observable chain
				return of(null);
			}),
			tap((employee: IEmployee) => {
				if (employee) {
					this.loading = false;
					this.appointmentFormURL = `/share/employee/${employee.id}/create-appointment`;
				}
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.eventType$ = this._route.params.pipe(
			// Ensure the route parameters are valid
			filter((params: Params) => !!params.eventId),
			// Fetch the event type from the event type service
			switchMap((params: Params) => this._eventTypeService.getEventTypeById(params.eventId)),
			// Store the event type in the 'eventType' property
			tap((eventType: IEventType) => (this.eventType = eventType)),
			// Handle errors
			catchError((error: any) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				// Navigate to the 404 page
				this._router.navigate(['/share/404']);
				// Return null to avoid breaking the observable chain
				return of(null);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	ngOnDestroy() {}
}
