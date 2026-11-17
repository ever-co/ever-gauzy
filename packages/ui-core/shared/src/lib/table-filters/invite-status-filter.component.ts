import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { InviteStatusEnum } from '@gauzy/contracts';

@Component({
	selector: 'ga-invite-status-filter',
	template: `
		<ng-select
			[ngModel]="restored"
			appendTo="body"
			[clearable]="true"
			[closeOnSelect]="true"
			[placeholder]="'SM_TABLE.STATUS' | translate"
			(change)="onChange($event)"
		>
			@for (status of inviteStatuses; track status) {
				<ng-option [value]="status">
					{{ status }}
				</ng-option>
			}
		</ng-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class InviteStatusFilterComponent extends RestorableFilterComponent {
	protected inviteStatuses = Object.values(InviteStatusEnum);

	/**
	 * Handles the status selection change.
	 * When the user clears the selection, value will be null/undefined which resets the filter.
	 *
	 * @param value - The selected invite status or null/undefined when cleared
	 */
	onChange(value: InviteStatusEnum | null | undefined): void {
		this.applyFilter(value ?? null);
	}
}
