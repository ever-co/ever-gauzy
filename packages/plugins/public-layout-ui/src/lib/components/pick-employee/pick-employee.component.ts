import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, tap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ID, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { EventTypeService, Store, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { EmployeeSelectorComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pick-employee',
	templateUrl: './pick-employee.component.html',
	styleUrls: ['./pick-employee.component.scss'],
	providers: [EventTypeService]
})
export class PickEmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading: boolean;
	public organization: IOrganization;
	public organization$: Observable<IOrganization>;

	@ViewChild('employeeSelector') employeeSelector: EmployeeSelectorComponent;

	constructor(
		readonly translateService: TranslateService,
		private readonly _router: Router,
		private readonly _toastrService: ToastrService,
		private readonly _eventTypeService: EventTypeService,
		private readonly _store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
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
	 * Book an appointment for the selected employee
	 *
	 * @returns {Promise<void>}
	 */
	async bookPublicEmployeeAppointment(): Promise<void> {
		if (!this.organization) {
			return;
		}

		// Extract organization and employee IDs
		const { id: organizationId, tenantId } = this.organization;

		// Get the selected employee
		const selectedEmployeeId: ID = this.employeeSelector.selectedEmployee?.id;

		// If an employee is selected, fetch the event types
		if (selectedEmployeeId) {
			try {
				let { items } = await this._eventTypeService.getAll(['employee', 'employee.user', 'tags'], {
					organizationId,
					tenantId,
					employee: { id: selectedEmployeeId },
					isActive: true,
					isArchived: false
				});

				if (items.length === 0) {
					({ items } = await this._eventTypeService.getAll(['tags'], {
						organizationId,
						tenantId,
						isActive: true,
						isArchived: false
					}));
				}

				// If exactly one event type is found, navigate to its page
				const navigatePath =
					items.length === 1
						? `/share/employee/${selectedEmployeeId}/${items[0].id}`
						: `/share/employee/${selectedEmployeeId}`;

				this._router.navigate([navigatePath]);
			} catch (error) {
				console.error('Error while fetching event types:', error);
				this._toastrService.danger(this.getTranslation('PUBLIC_APPOINTMENTS.SELECT_EMPLOYEE_ERROR'));
			}
		} else {
			this._toastrService.danger(this.getTranslation('PUBLIC_APPOINTMENTS.SELECT_EMPLOYEE_ERROR'));
		}
	}

	ngOnDestroy() {}
}
