import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IOrganizationEmploymentType } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { OrganizationEmploymentTypesService, Store } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-employment-type-filter',
	template: `
		<ng-select
			id="employmentType"
			[items]="employmentTypes"
			bindLabel="name"
			[searchable]="false"
			placeholder="{{ 'EMPLOYEES_PAGE.EDIT_EMPLOYEE.EMPLOYMENT_TYPE' | translate }}"
			appendTo="body"
			multiple="true"
			(change)="selectedEmploymentTypeEvent($event)"
		>
		</ng-select>
	`,
	styles: [
		`
			::ng-deep angular2-smart-table table .angular2-smart-filter .ng-select .ng-select-container {
				height: auto;
			}
		`
	],
	standalone: false
})
@UntilDestroy({ checkProperties: true })
export class EmploymentTypeFilterComponent extends DefaultFilter implements OnInit, OnChanges {
	employmentTypes: IOrganizationEmploymentType[] = [];

	constructor(
		private readonly organizationEmploymentTypesService: OrganizationEmploymentTypesService,
		private readonly store: Store
	) {
		super();
	}

	ngOnInit(): void {
		const { id: organizationId, tenantId } = this.store.selectedOrganization;

		// Fetch employment types from the service and subscribe to the observable for asynchronous updates
		this.organizationEmploymentTypesService
			.getAll([], {
				tenantId,
				organizationId
			})
			.pipe(untilDestroyed(this)) // Ensure the subscription is destroyed when the component is destroyed
			.subscribe((types) => {
				// Store the fetched employment types in a class-level property
				this.employmentTypes = types.items;
			});
	}

	ngOnChanges(changes: SimpleChanges) {}

	selectedEmploymentTypeEvent(value: IOrganizationEmploymentType[]) {
		this.column.filterFunction(value, this.column.id);
	}
}
