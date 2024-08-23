import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IEmployee, IEventType, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { EmployeesService, ErrorHandlingService, EventTypeService, Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-public-appointments',
	templateUrl: './public-appointments.component.html',
	styleUrls: ['./public-appointments.component.scss'],
	providers: [EventTypeService]
})
export class PublicAppointmentsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public employee: IEmployee;
	public employee$: Observable<IEmployee | null>;
	public organization: IOrganization;
	public organization$: Observable<IOrganization>;
	public loading: boolean = false;
	public eventTypes: IEventType[] = [];
	public eventTypesExist: boolean;

	constructor(
		readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _employeeService: EmployeesService,
		private readonly _eventTypeService: EventTypeService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Create an observable for the employee based on route parameters
		this.employee$ = this._route.params.pipe(
			// Ensure the route parameters are valid
			filter((params: Params) => !!params.id),
			// Fetch the employee from the employee service
			switchMap((params: Params) => this._employeeService.getEmployeeById(params.id, ['user'])),
			// Store the employee in the 'employee' property
			tap((employee: IEmployee) => (this.employee = employee)),
			// Fetch event types
			tap(() => this.getEventTypes()),
			// Handle errors
			catchError((error: any) => {
				// Handle and log errors
				this._errorHandlingService.handleError(error);
				return of(null);
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.organization$ = this._store.selectedOrganization$.pipe(
			// Ensure the selected organization is valid
			filter((organization: IOrganization) => !!organization),
			// Fetch the unique organization
			distinctUntilChange(),
			// Store the organization in the 'organization' property
			tap((organization: IOrganization) => (this.organization = organization)),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
	}

	/**
	 * Fetches and processes event types based on the organization and employee details.
	 *
	 * @returns {Promise<void>}
	 */
	async getEventTypes(): Promise<void> {
		if (!this.organization || !this.employee) {
			return;
		}

		// Set loading state to true
		this.loading = true;

		// Extract organization and employee IDs
		const { id: organizationId, tenantId } = this.organization;
		const { id: employeeId } = this.employee;

		try {
			let { items } = await this._eventTypeService.getAll(['employee', 'employee.user', 'tags'], {
				organizationId,
				tenantId,
				employee: { id: employeeId },
				isActive: true,
				isArchived: false
			});

			// If no event types are found for the employee, fetch generic event types
			if (items.length === 0) {
				({ items } = await this._eventTypeService.getAll(['tags'], {
					organizationId,
					tenantId,
					isActive: true,
					isArchived: false
				}));
			}

			// If exactly one event type is found, navigate to its page
			if (items.length === 1) {
				// Get the first event type
				const eventType = items[0];

				// Navigate to the event type page
				this._router.navigate([`/share/employee/${employeeId}/${eventType.id}`]);
			} else if (items.length > 0) {
				this.eventTypesExist = true;
			}

			// Sort event types by duration and duration unit
			const eventTypesOrder = ['Minute(s)', 'Hour(s)', 'Day(s)'];

			// Sort event types by duration and duration unit
			this.eventTypes = items.sort((a, b) => {
				// Compare by duration unit first
				const comparison = eventTypesOrder.indexOf(a.durationUnit) - eventTypesOrder.indexOf(b.durationUnit);
				// If duration units are the same, compare by duration
				return comparison !== 0 ? comparison : a.duration - b.duration;
			});
		} catch (error) {
			console.error('Error while fetching event types:', error);
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		} finally {
			// Set loading state to false
			this.loading = false;
		}
	}

	/**
	 * Select event type
	 *
	 * @param id
	 */
	selectEventType(id: ID) {
		this._router.navigate([`${this._router.url}/${id}`]);
	}

	ngOnDestroy() {}
}
