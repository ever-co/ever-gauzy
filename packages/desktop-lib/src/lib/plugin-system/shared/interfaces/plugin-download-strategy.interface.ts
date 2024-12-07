import { IPluginMetadata } from './plugin-metadata.interface';

export interface IPluginDownloadResponse {
	pathDirname: string;
	metadata: IPluginMetadata;
}

export interface IPluginDownloadStrategy {
	execute<T>(config: T): Promise<IPluginDownloadResponse>;
}

export interface ICdnDownloadConfig {
	url: string;
	pluginPath: string;
}

export type ILocalDownloadConfig = Pick<ICdnDownloadConfig, 'pluginPath'>;

export interface INpmDownloadConfig {
	registry?: {
		privateURL?: string;
		authToken?: string;
	};
	pkg: {
		name: string;
		version?: string;
	};
	pluginPath: string;
}
