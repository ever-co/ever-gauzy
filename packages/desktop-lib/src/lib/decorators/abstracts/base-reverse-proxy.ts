import { IServerConfig } from '../../interfaces';
import * as httpProxy from 'http-proxy';
import { StaticServer } from '../../server/static-server';

export abstract class BaseReverseProxy extends StaticServer {
	protected _config: IServerConfig;
	protected _proxy = httpProxy.createProxyServer();

	protected constructor(readonly serverConfig: IServerConfig) {
		super();
		this._config = serverConfig;
		this.app.use((req, res, next) => {
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
			next();
		});
	}

	protected abstract preprocess(): void;
}
