import { Component } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { InviteStatusEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-invite-status-filter',
	template: `
		<ng-select
			[clearable]="true"
			[closeOnSelect]="true"
			[placeholder]="'SM_TABLE.STATUS' | translate"
			(change)="onChange($event)"
		>
			<ng-option *ngFor="let status of inviteStatuses" [value]="status">
				{{ status }}
			</ng-option>
		</ng-select>
	`,
	standalone: false
})
export class InviteStatusFilterComponent extends DefaultFilter {
	protected inviteStatuses = Object.values(InviteStatusEnum);

	constructor() {
		super();
	}

	/**
	 * Handles the status selection change.
	 * When the user clears the selection, value will be null/undefined which resets the filter.
	 *
	 * @param value - The selected invite status or null/undefined when cleared
	 */
	onChange(value: InviteStatusEnum | null | undefined): void {
		this.column.filterFunction(value ?? null, this.column.id);
	}
}
