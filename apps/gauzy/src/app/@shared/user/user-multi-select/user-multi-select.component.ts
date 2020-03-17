import { Component, EventEmitter, Input, Output } from '@angular/core';
import { User } from '@gauzy/models';

@Component({
	selector: 'ga-user-multi-select',
	templateUrl: './user-multi-select.component.html'
})
export class UserSelectComponent {
	@Input() selectedUserIds: string[];
	@Input() allUsers: User[];

	@Output() selectedChange = new EventEmitter();

	constructor() {}

	onMembersSelected(selectEvent: any): void {
		this.selectedChange.emit(selectEvent);
	}
}
