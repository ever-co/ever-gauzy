import {IPowerManager} from "lib/interfaces";

export abstract class BasePowerManagerDecorator {
	private _decorator: IPowerManager;

	protected constructor(powerManager: IPowerManager) {
		this._decorator = powerManager;
	}
}
