import { IClientServerProvider, IServerLessProvider } from '../interfaces';

export class DatabaseProviderContext {
	private _provider: IServerLessProvider | IClientServerProvider;

	constructor(provider?: IServerLessProvider | IClientServerProvider) {
		this._provider = provider
	}

	public set provider(value: IServerLessProvider | IClientServerProvider) {
		this._provider = value;
	}

	public get provider(): IServerLessProvider | IClientServerProvider {
		return this._provider;
	}
}
