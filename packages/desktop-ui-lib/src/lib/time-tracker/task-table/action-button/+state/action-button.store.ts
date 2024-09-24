import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';

export enum ActionButton {
	ADD = 'adding',
	VIEW = 'viewing',
	EDIT = 'editing',
	DELETE = 'deleting',
	NONE = 'none'
}

export interface IActionButtonState {
	toggle: boolean;
	action: ActionButton;
}

export function createInitialState(): IActionButtonState {
	return {
		toggle: false,
		action: ActionButton.NONE
	};
}

@StoreConfig({ name: '_actionButton' })
@Injectable({ providedIn: 'root' })
export class ActionButtonStore extends Store<IActionButtonState> {
	constructor() {
		super(createInitialState());
	}
}
