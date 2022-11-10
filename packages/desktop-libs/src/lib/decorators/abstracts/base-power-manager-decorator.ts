import {IPowerManager} from "../../interfaces";

export abstract class BasePowerManagerDecorator {
	private readonly _decorator: IPowerManager;

	protected constructor(powerManager: IPowerManager) {
		this._decorator = powerManager;
	}

	public get decorator(): IPowerManager {
		return this._decorator;
	}
}
