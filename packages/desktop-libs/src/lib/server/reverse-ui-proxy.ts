import { IServerConfig } from '../interfaces';
import * as fs from 'fs';
import { BaseReverseProxy } from '../decorators';

export class ReverseUiProxy extends BaseReverseProxy {
	constructor(readonly serverConfig: IServerConfig) {
		super(serverConfig);
	}

	public override start(): void {
		this.preprocess();
		super.start();
	}

	public override stop(): void {
		if (!this._config.setting.secureProxy.enable || !this.running) {
			return;
		}
		super.stop();
	}

	protected preprocess(): void {
		this.kill();
		this.port = this._config.uiPort;
		this.app.all('*', (req, res) => {
			this._proxy.web(req, res, {
				target: { host: 'localhost', port: this._config.uiPort },
				...(this._config.setting.secureProxy.enable && {
					ssl: {
						key: fs.readFileSync(this._config.setting.secureProxy.ssl.key, 'utf8'),
						cert: fs.readFileSync(this._config.setting.secureProxy.ssl.cert, 'utf8')
					},
					secure: this._config.setting.secureProxy.secure
				})
			});
		});
	}
}
