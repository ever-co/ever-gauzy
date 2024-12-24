import { IServerConfig } from '../interfaces';
import { SecuredProxy } from './secured-proxy';

export class ReverseUiProxy extends SecuredProxy {
	constructor(readonly serverConfig: IServerConfig) {
		super(serverConfig);
	}

	public override start(): void {
		this.port = this._config.uiPort;
		super.start();
	}
}
