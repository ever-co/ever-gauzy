import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import {
	IBaseEntityWithMembers,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { IPersonListItem } from '../table-components/people-list/people-list.component';

@Component({
    selector: 'ga-entity-with-members-card',
    templateUrl: './entity-with-members-card.component.html',
    styleUrls: ['./entity-with-members-card.component.scss'],
    standalone: false
})
export class EntityWithMembersCardComponent {
	@Input() entityWithMembers: IBaseEntityWithMembers;

	@Input() public: IBaseEntityWithMembers;

	@Input() visibleViewButton: boolean = false;

	@Output() remove = new EventEmitter();
	@Output() edit = new EventEmitter();
	@Output() view = new EventEmitter();

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	constructor(private readonly router: Router) {}

	/**
	 * Opens the profile of a member clicked in the people list.
	 *
	 * @param person The member that was clicked.
	 */
	openMember(person: IPersonListItem): void {
		const id = person?.id;
		if (id) {
			this.router.navigate([`/pages/employees/edit/${id}/profile`]);
		}
	}

	removeEntity(id: string): void {
		this.remove.emit(id);
	}

	editEntity(id: string): void {
		this.edit.emit(id);
	}

	navigateContact(item: any): void {
		this.view.emit(item);
	}
}
