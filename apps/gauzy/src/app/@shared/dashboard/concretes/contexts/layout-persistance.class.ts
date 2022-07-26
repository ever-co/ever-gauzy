import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { ILayoutPersistance } from '../../interfaces/layout-persistance.interface';
import { IPersistance } from '../../interfaces/persistance.interface';
import { Persistance } from './persistance.class';

export class LayoutPersistance implements ILayoutPersistance {
	private _state: Partial<GuiDrag>[];

	save(): IPersistance {
		return new Persistance(this, this.state);
	}

	restore(): Partial<GuiDrag>[] {
		return this.state;
	}

	public get state(): Partial<GuiDrag>[] {
		return this._state;
	}

	public set state(value: Partial<GuiDrag>[]) {
		this._state = value;
	}
}
