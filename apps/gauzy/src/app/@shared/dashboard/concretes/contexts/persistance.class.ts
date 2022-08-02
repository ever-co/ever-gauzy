import { GuiDrag } from '../../interfaces/gui-drag.abstract';
import { IPersistance } from '../../interfaces/persistance.interface';

export class Persistance implements IPersistance {
	private _state: Partial<GuiDrag>[];

	constructor(state: Partial<GuiDrag>[]) {
		this._state = state;
	}
	public get state(): Partial<GuiDrag>[] {
		return this._state;
	}
}
