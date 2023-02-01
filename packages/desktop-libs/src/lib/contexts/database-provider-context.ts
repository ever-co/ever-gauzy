import { IDatabaseProvider } from '../interfaces/i-database-provider';

export class DatabaseProviderContext {
	private _provider: IDatabaseProvider;
	constructor(provider?: IDatabaseProvider) {
		this._provider = provider;
	}
	public set provider(value: IDatabaseProvider) {
		this._provider = value;
	}

	public get provider(): IDatabaseProvider {
		return this._provider;
	}
}
