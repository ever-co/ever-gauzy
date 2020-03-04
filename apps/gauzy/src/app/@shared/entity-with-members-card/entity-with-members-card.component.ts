import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BaseEntityWithMembers } from '@gauzy/models';

@Component({
	selector: 'ga-entity-with-members-card',
	templateUrl: './entity-with-members-card.component.html',
	styleUrls: ['./entity-with-members-card.component.scss']
})
export class EntityWithMembersCardComponent {
	@Input() entityWithMembers: BaseEntityWithMembers;

	@Input() public: BaseEntityWithMembers;

	@Output() remove = new EventEmitter();

	@Output() edit = new EventEmitter();

	removeEntity(id: string): void {
		this.remove.emit(id);
	}

	editEntity(id: string): void {
		this.edit.emit(id);
	}
}
