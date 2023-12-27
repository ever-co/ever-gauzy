import { IServerConfig } from '../interfaces';
import { BaseReverseProxy } from '../decorators';

export class ReverseProxy extends BaseReverseProxy {
	constructor(readonly serverConfig: IServerConfig) {
		super(serverConfig);
	}

	public override start(): void {
		this.preprocess();
		super.start();
	}

	protected preprocess(): void {
		this.kill();
		this.port = this._config.apiPort;
		this.app.all('*', (req, res) => {
			this._proxy.web(req, res, {
				target: { host: 'localhost', port: this._config.apiPort }
			});
		});
	}
}
