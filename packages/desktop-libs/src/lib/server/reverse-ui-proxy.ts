import { IServerConfig } from '../interfaces';
import * as fs from 'fs';
import { BaseReverseProxy } from '../decorators';
import { createServer } from 'https';
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
		const sslConfig: ISsl = this.readSslConfig();
		this.kill();
		this.configureProxy(sslConfig);
		this.createServerWithSsl(sslConfig);
	}

	private readSslConfig(): ISsl {
		try {
			return {
				key: fs.readFileSync(this._config.setting.secureProxy.ssl.key, 'utf8'),
				cert: fs.readFileSync(this._config.setting.secureProxy.ssl.cert, 'utf8')
			};
		} catch (error) {
			console.error('ERROR: Reading SSL configuration:', error);
		}
	}

	private configureProxy(sslConfig: ISsl): void {
		this.port = this._config.uiPort;
		this.app.all('*', (req, res) => {
			this._proxy.web(req, res, {
				target: { host: 'localhost', port: this._config.uiPort },
				...(this._config.setting.secureProxy.enable && {
					ssl: sslConfig,
					secure: this._config.setting.secureProxy.secure
				})
			});
		});
	}

	private createServerWithSsl(sslConfig: ISsl): void {
		try {
			this.server = createServer(sslConfig, this.app);
		} catch (error) {
			console.error('ERROR: Creating HTTPS server:', error);
		}
	}
}
