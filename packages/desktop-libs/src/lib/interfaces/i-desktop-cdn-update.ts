import { IDesktopUpdate } from './i-desktop-update';
import IUpdaterConfig from './i-updater-config';

export interface IDesktopCdnUpdate extends IDesktopUpdate {
	tagName(): Promise<string>;
	get config(): IUpdaterConfig;
	get isPrerelease(): boolean;
}
