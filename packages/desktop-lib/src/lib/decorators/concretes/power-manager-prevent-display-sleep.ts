import {IPowerManager} from '../../interfaces';
import {BasePowerManagerDecorator} from '../abstracts/base-power-manager-decorator';
import {powerSaveBlocker} from "electron";

export class PowerManagerPreventDisplaySleep extends BasePowerManagerDecorator {
	private _powerSaverBlockedId: number;

	constructor(powerManager: IPowerManager) {
		super(powerManager);
		this._powerSaverBlockedId = -1;
	}

	public start(): void {
		this._powerSaverBlockedId = powerSaveBlocker.start('prevent-display-sleep');
		if (powerSaveBlocker.isStarted(this._powerSaverBlockedId)) console.log('Prevent display sleep while tracking!');
		else console.log('Can\'t setup power save blocker');
	}

	public stop(): void {
		if (this._powerSaverBlockedId > -1 && powerSaveBlocker.isStarted(this._powerSaverBlockedId)) {
			console.log('Now display can sleep!');
			powerSaveBlocker.stop(this._powerSaverBlockedId);
		}
	}
}
