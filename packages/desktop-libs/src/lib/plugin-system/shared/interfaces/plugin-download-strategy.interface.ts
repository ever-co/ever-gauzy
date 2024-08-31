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
