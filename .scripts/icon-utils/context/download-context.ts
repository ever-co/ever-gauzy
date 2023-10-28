import { IDownloadStrategy } from '../interfaces/i-download-strategy';

export class DownloadContext {
	private _strategy: IDownloadStrategy;
	constructor(strategy?: IDownloadStrategy) {
		this.strategy = strategy;
	}

	public get strategy(): IDownloadStrategy {
		return this._strategy;
	}

	public set strategy(value: IDownloadStrategy) {
		this._strategy = value;
	}
}
