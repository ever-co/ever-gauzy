import { IDesktopCdnUpdate } from "../../interfaces/i-desktop-cdn-update";
import { UpdateStrategy } from "../abstracts/update-strategy";
import fetch from 'node-fetch';
import IUpdaterConfig from "../../interfaces/i-updater-config";


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
            return await fetch(
                `https://github.com/${this.config.owner}/${this.config.repository}/${this.config.typeRelease}/latest`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    }
                }
            ).then((res) => res.json())
        } catch (e) {
            console.log('Error', e);
            return null;
        }
    }

    public get config(): IUpdaterConfig {
        return this._config;
    }
}
