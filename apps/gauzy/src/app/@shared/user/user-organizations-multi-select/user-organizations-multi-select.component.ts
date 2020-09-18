import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IOrganization } from '@gauzy/models';

@Component({
	selector: 'ga-user-organizations-multi-select',
	templateUrl: './user-organizations-multi-select.component.html'
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
