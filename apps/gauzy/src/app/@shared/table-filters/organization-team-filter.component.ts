import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { combineLatest, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IOrganization, IOrganizationTeam, ISelectedEmployee } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { OrganizationTeamsService, Store } from '../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-team-select-filter',
	template: `
		<ng-select
			[clearable]="true"
			[closeOnSelect]="true"
			[placeholder]="'TASKS_PAGE.SELECT' | translate"
			(change)="onChange($event)"
		>
			<ng-option *ngFor="let team of teams" [value]="team">
				{{ team.name }}
			</ng-option>
		</ng-select>
	`
})
export class OrganizationTeamFilterComponent extends DefaultFilter implements OnInit, OnChanges {
	public teams: IOrganizationTeam[] = [];
	public organization: IOrganization;
	public selectedEmployeeId: ISelectedEmployee['id'];
	public subject$: Subject<any> = new Subject();

	constructor(private readonly store: Store, private readonly organizationTeamsService: OrganizationTeamsService) {
		super();
	}

	ngOnInit() {
		this.subject$
			.pipe(
				// Tap operator: Perform actions when a notification is received
				tap(() => this.getTeams()),
				// untilDestroyed: Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the selected organization and employee
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;

		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				// Ensure distinct combinations are processed
				distinctUntilChange(),
				// Filter out combinations where the organization is falsy
				filter(([organization]) => !!organization),
				// Perform actions when new values are emitted
				tap(([organization, employee]) => {
					// Update component properties based on the emitted values
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				// Emit a notification to trigger further actions
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	onChange(value: IOrganizationTeam) {
		this.column.filterFunction(value, this.column.id);
	}

	/**
	 *
	 * @returns
	 */
	async getTeams() {
		if (!this.organization) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;

			// Fetch teams from the service
			const { items = [] } = await this.organizationTeamsService.getMyTeams({
				organizationId,
				tenantId,
				// Additional parameters based on selectedEmployeeId
				...(this.selectedEmployeeId
					? {
							members: {
								employeeId: this.selectedEmployeeId
							}
					  }
					: {})
			});

			// Update the teams property with the fetched items
			this.teams = items;
		} catch (error) {
			// Handle errors, log or display error messages
			console.error('Error while fetching teams:', error);
			// You might want to notify the user or perform other error handling actions
		}
	}
}
