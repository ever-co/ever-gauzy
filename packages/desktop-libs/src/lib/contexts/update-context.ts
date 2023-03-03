import { IDesktopUpdate } from "../interfaces/i-desktop-update";
import { UpdateInfo } from "electron-updater";


export class UpdateContext {
	private _strategy: IDesktopUpdate;

	public set strategy(strategy: IDesktopUpdate) {
		this._strategy = strategy;
	}

	public update() {
		this._strategy.update();
	}

	public notify(info: UpdateInfo) {
		this._strategy.notify(info);
	}

	public async checkUpdate(): Promise<void> {
		await this._strategy.checkUpdate();
	}

	public cancel() {
		this._strategy.cancel();
	}
}
