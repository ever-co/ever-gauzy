import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { LayoutPersistance } from './layout-persistance.class';
import { IPersistance } from '../../interfaces/persistance.interface';

export class Persistance implements IPersistance {
	private _state: Partial<GuiDrag>[];
	private _layoutPersistance: LayoutPersistance;

	constructor(
		layoutPersistance: LayoutPersistance,
		state: Partial<GuiDrag>[]
	) {
		this._state = state;
		this._layoutPersistance = layoutPersistance;
	}
	restore(): Partial<GuiDrag>[] {
		return this._state;
	}
}
