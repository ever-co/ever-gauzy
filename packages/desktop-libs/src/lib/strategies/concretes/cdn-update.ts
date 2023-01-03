import { IDesktopCdnUpdate } from "../../interfaces/i-desktop-cdn-update";
import { UpdateStrategy } from "../abstracts/update-strategy";
import fetch from 'node-fetch';
import IUpdaterConfig from "../../interfaces/i-updater-config";
import { app } from "electron";
import { LocalStore } from "../../desktop-store";


export class CdnUpdate extends UpdateStrategy implements IDesktopCdnUpdate {
    private _config: IUpdaterConfig;

    constructor(config: IUpdaterConfig) {
        super();
        this._config = config;
    }

    public get url(): string {
        return this._url;
    }

    public set url(value: string) {
        this._url = value;
    }

    public async tagName(): Promise<string> {
        try {
			const releases = await fetch(
				`https://api.github.com/repos/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}`,
				{
					method: 'GET',
					headers: {
						Accept: 'application/vnd.github+json'
					}
				}
			).then((res) => res.json());
			return releases.filter(
				(release) => release.prerelease === this.isPrerelease
			)[0].tag_name;
		} catch (e) {
			console.log('Error', e);
			return app.getVersion();
		}
    }

    public get config(): IUpdaterConfig {
        return this._config;
    }

    public get isPrerelease(): boolean {
        const setting = LocalStore.getStore('appSetting');
        return setting && setting.prerelease;
    }
}
