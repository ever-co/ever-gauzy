import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
	IBaseEntityWithMembers,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';

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
