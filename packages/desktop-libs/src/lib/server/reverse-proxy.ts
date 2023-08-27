import { IServerConfig } from '../interfaces';
import { StaticServer } from './static-server';
import httpProxy from 'http-proxy';

export class ReverseProxy extends StaticServer {
	private _config: IServerConfig;
	private _proxy = httpProxy.createProxyServer();

	constructor(readonly serverConfig: IServerConfig) {
		super();
		this._config = serverConfig;
		this.app.use((req, res, next) => {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
			next();
		});
	}

	public start(): void {
		this.prestart();
		super.start();
	}

	private prestart(): void {
		this.kill();
		this.port = this._config.apiPort;
		this.app.all('*', (req, res) => {
			this._proxy.web(req, res, {
				target: { host: 'localhost', port: this._config.apiPort },
			});
		});
	}
}
