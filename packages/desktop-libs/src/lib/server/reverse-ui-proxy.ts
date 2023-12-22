import { IServerConfig } from '../interfaces';
import * as fs from 'fs';
import { BaseReverseProxy } from '../decorators';
import * as https from 'https';
import { ISsl } from '@gauzy/contracts';

export class ReverseUiProxy extends BaseReverseProxy {
	constructor(readonly serverConfig: IServerConfig) {
		super(serverConfig);
	}

	public override start(): void {
		if (!this._config.setting.secureProxy.enable) {
			return;
		}
		this.preprocess();
		this.server.listen(this.port, () => {
			console.log(`⚡️[server]: Secure server is running at https://${this.serverConfig.uiUrl} 🚀`);
			this._isRunning = true;
		});
	}

	public override stop(): void {
		if (!this._config.setting.secureProxy.enable || !this.running) {
			return;
		}
		super.stop();
	}

	protected preprocess(): void {
		const ssl: ISsl = {
			key: fs.readFileSync(this._config.setting.secureProxy.ssl.key, 'utf8'),
			cert: fs.readFileSync(this._config.setting.secureProxy.ssl.cert, 'utf8')
		};
		this.kill();
		this.port = this._config.uiPort;
		this.app.all('*', (req, res) => {
			this._proxy.web(req, res, {
				target: { host: 'localhost', port: this._config.uiPort },
				...(this._config.setting.secureProxy.enable && {
					ssl,
					secure: this._config.setting.secureProxy.secure
				})
			});
		});
		this.server = https.createServer(ssl, this.app);
	}
}
