import { AfterViewInit, ChangeDetectorRef, Component, Input, OnInit, ViewChild } from '@angular/core';
import { filter, tap } from 'rxjs';
import { Cell, DefaultEditor } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { JobSearchStoreService, Store } from '@gauzy/ui-core/core';
import { ToggleSwitcherComponent } from '../toggle-switcher/toggle-switcher.component';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<ngx-toggle-switcher [label]="false" (onSwitched)="updateJobSearchAvailability($event)"></ngx-toggle-switcher>
	`
})
export class JobSearchAvailabilityEditorComponent extends DefaultEditor implements AfterViewInit, OnInit {
	public organization: IOrganization;
	public employee: IEmployee;

	// Reference to the cell object
	@Input() cell!: Cell;

	// Reference to the ToggleSwitcherComponent instance
	@ViewChild(ToggleSwitcherComponent) switcher!: ToggleSwitcherComponent;

	constructor(
		private readonly _cdr: ChangeDetectorRef,
		private readonly _store: Store,
		private readonly _jobSearchStoreService: JobSearchStoreService
	) {
		super();
	}

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.employee = this.cell.getRow()?.getData();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		if (!this.switcher) {
			return;
		}
		this.switcher.value = this.employee?.isJobSearchActive || false;
		this._cdr.detectChanges(); // Force change detection to update the UI
	}

	/**
	 * Updates the job search availability status of an employee within the organization.
	 *
	 * @param isJobSearchActive - A boolean flag indicating whether the job search is active.
	 */
	updateJobSearchAvailability(isJobSearchActive: boolean): void {
		try {
			// Call the service to update the job search availability status
			this._jobSearchStoreService.updateJobSearchAvailability(
				this.organization,
				this.employee,
				isJobSearchActive
			);
		} catch (error) {
			// Log the error for debugging purposes
			console.log('Error while updating job search availability:', error);
		}
	}
}
