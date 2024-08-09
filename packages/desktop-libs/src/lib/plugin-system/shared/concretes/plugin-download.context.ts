import { IPluginDownloadResponse, IPluginDownloadStrategy } from '../interfaces';

export class PluginDownloadContext {
	private strategy: IPluginDownloadStrategy;

	constructor(strategy: IPluginDownloadStrategy) {
		this.strategy = strategy;
	}

	public setStrategy(strategy: IPluginDownloadStrategy): void {
		this.strategy = strategy;
	}

	public async execute<T>(packageConfig: T): Promise<IPluginDownloadResponse> {
		return this.strategy.execute(packageConfig);
	}
}
