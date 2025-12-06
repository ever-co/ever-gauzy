import { Component, OnChanges, SimpleChanges } from '@angular/core';
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
export class InviteStatusFilterComponent extends DefaultFilter implements OnChanges {
	public inviteStatuses = Object.values(InviteStatusEnum);

	constructor() {
		super();
	}

	/**
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 * @param value
	 */
	onChange(value: InviteStatusEnum) {
		this.column.filterFunction(value, this.column.id);
	}
}

