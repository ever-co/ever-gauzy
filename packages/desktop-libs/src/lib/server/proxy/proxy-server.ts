import { StaticServer } from '../static-server';
import { IProxyServer } from '../../interfaces';
import httpProxy from 'http-proxy';

export abstract class ProxyServer extends StaticServer implements IProxyServer {
	private _proxy = httpProxy.createProxyServer();
	protected constructor() {
		super();

		this.app.use((req, res, next) => {
			// Set the necessary headers to allow cross-origin requests
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader(
				'Access-Control-Allow-Methods',
				'GET, POST, PUT, DELETE, OPTIONS'
			);
			res.setHeader(
				'Access-Control-Allow-Headers',
				'Origin, X-Requested-With, Content-Type, Accept'
			);
			next();
		});
	}

	public start(): void {
		this.app.all('*', (req, res) => {
			// Forward the request to the target IP address and port
			this._proxy.web(req, res, {
				target: {
					host: 'localhost',
					port: this.port - 1,
				},
			});
		});
		super.start();
	}

	public onStop<T>(listener: () => T) {
		this.server.on('close', listener.bind(this));
	}

	public onError<T>(listener: (error: string) => T) {
		this.server.on('error', listener.bind(this));
	}
}
