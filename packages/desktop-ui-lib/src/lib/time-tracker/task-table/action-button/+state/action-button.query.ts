import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { ActionButton, ActionButtonStore, IActionButtonState } from './action-button.store';

@Injectable({ providedIn: 'root' })
export class ActionButtonQuery extends Query<IActionButtonState> {
	public readonly toggle$: Observable<boolean> = this.select((state) => state.toggle);
	public readonly action$: Observable<ActionButton> = this.select((state) => state.action);
	constructor(protected store: ActionButtonStore) {
		super(store);
	}

	public get toggle(): boolean {
		return this.getValue().toggle;
	}

	public get action(): ActionButton {
		return this.getValue().action;
	}

}
