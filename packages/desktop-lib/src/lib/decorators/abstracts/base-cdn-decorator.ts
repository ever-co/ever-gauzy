import { IDesktopCdnUpdate } from '../../interfaces/i-desktop-cdn-update';
import IUpdaterConfig from '../../interfaces/i-updater-config';
import { UpdateInfo } from "electron-updater";

export abstract class BaseCdnDecorator implements IDesktopCdnUpdate {
	private _decorator: IDesktopCdnUpdate;

	constructor(update: IDesktopCdnUpdate) {
		this._decorator = update;
	}
	public get isPrerelease(): boolean {
		return this._decorator.isPrerelease;
	}
    cancel(): void {
        this._decorator.cancel();
    }

	public async tagName(): Promise<string> {
		return await this._decorator.tagName();
	}

	public async checkUpdate(): Promise<void> {
		await this._decorator.checkUpdate();
	}

	public get config(): IUpdaterConfig {
		return this._decorator.config
	}

	public get url(): string {
		return this._decorator.url;
	}

	public set url(value: string) {
		this._decorator.url = value
	}

	public update(): void {
		this._decorator.update();
	}

	public notify(info: UpdateInfo): void {
		this._decorator.notify(info);
	}
}
