import { GuiDrag, IPersistance } from '@gauzy/ui-sdk/common';

export class Persistance implements IPersistance {
	private _state: Partial<GuiDrag>[];

	constructor(state: Partial<GuiDrag>[]) {
		this._state = state;
	}
	public get state(): Partial<GuiDrag>[] {
		return this._state;
	}
}
