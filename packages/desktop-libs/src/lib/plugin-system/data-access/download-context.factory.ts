import { IPluginDownloadStrategy, PluginDownloadContext, PluginDownloadContextType } from '../shared';
import { CdnDownloadStrategy } from './strategies/cdn-download.strategy';

export class DownloadContextFactory {
	public static getContext(name = PluginDownloadContextType.CDN) {
		let strategy: IPluginDownloadStrategy;
		switch (name) {
			case PluginDownloadContextType.CDN:
				strategy = new CdnDownloadStrategy();
				break;
			//TODO: Add more strategies later
			default:
				throw new Error('Uknown context');
		}

		return new PluginDownloadContext(strategy);
	}
}
