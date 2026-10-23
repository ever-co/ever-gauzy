import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';

@Component({
    selector: 'ga-user-organizations-multi-select',
    templateUrl: './user-organizations-multi-select.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class UserOrganizationsSelectComponent {
	@Input() selectedOrganizationsId: string[];
	@Input() allOrganizations: IOrganization[];

	@Output() selectedChange = new EventEmitter();

	constructor() {}

	onOrganizationsSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
