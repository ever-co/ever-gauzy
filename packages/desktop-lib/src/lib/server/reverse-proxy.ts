import { IServerConfig } from '../interfaces';
import { SecuredProxy } from './secured-proxy';

export class ReverseProxy extends SecuredProxy {
	constructor(readonly serverConfig: IServerConfig) {
		super(serverConfig);
	}

	public override start(): void {
		this.port = this._config.apiPort;
		super.start();
	}
}
