import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { ILayoutPersistance } from '../../interfaces/layout-persistance.interface';
import { IPersistance } from '../../interfaces/persistance.interface';
import { Persistance } from './persistance.class';

export class LayoutPersistance implements ILayoutPersistance {
	private _state: Partial<GuiDrag>[];

	public save(): Persistance {
		return new Persistance(this._state);
	}

	public restore(persistance: IPersistance): void {
		this._state = persistance.state;
	}

	public get state(): Partial<GuiDrag>[] {
		return this._state;
	}

	public set state(value: Partial<GuiDrag>[]) {
		this._state = value;
	}
}
