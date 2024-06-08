import { IPersistance } from '@gauzy/ui-sdk/common';
import { LayoutPersistance } from './layout-persistance.class';

export class PersistanceTakers {
	private _persistances: IPersistance[] = [];
	private _layout: LayoutPersistance;

	constructor(layout: LayoutPersistance) {
		this._layout = layout;
	}

	public backup() {
		this._persistances.push(this._layout.save());
	}

	public undo() {
		if (!this._persistances.length) return;
		const persistance = this._persistances.pop();
		this._layout.restore(persistance);
	}
}
