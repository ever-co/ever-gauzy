import { IDesktopCdnUpdate } from './i-desktop-cdn-update';

export interface IDesktopGithubUpdate extends IDesktopCdnUpdate {
	initialize(): Promise<void>;
}
