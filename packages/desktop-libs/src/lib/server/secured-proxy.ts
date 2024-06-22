import { IServerConfig, IServerFactory } from '../interfaces';
import { BaseReverseProxy } from '../decorators';
import { ISsl } from '@gauzy/contracts';
import { IpcMainEvent, ipcMain } from 'electron';
import { IncomingMessage, ServerResponse } from 'http';
import { ServerOptions } from 'http-proxy';
import { LOCAL_SERVER_UPDATE_CONFIG } from '../config';
import { ISslFactory } from '../interfaces/i-server-factory';
import { SslFactory } from './ssl-factory';
import { ServerFactory } from './server-factory';

export abstract class SecuredProxy extends BaseReverseProxy {
	private readonly sslFactory: ISslFactory;
	private readonly serverFactory: IServerFactory;

	constructor(public readonly serverConfig: IServerConfig) {
		super(serverConfig);
		this.sslFactory = new SslFactory();
		this.serverFactory = new ServerFactory();
		this.setupIpcMain();
	}

	public override start(): void {
		if (!this.serverConfig.setting.secureProxy.enable) {
			return;
		}
		this.preprocess();
		super.start();
	}

	public override stop(): void {
		if (!this.serverConfig.setting.secureProxy.enable || !this.running) {
			return;
		}
		super.stop();
	}

	protected preprocess(): void {
		const sslConfig: ISsl = this.sslFactory.createSslConfig(this.serverConfig.setting.secureProxy);
		this.kill();
		this.configureProxy(sslConfig);
		this.createServerWithSsl(sslConfig);
	}

	protected configureProxy(sslConfig: ISsl): void {
		this.app.all('*', (req: IncomingMessage, res: ServerResponse) => {
			const proxyOptions: ServerOptions = {
				changeOrigin: true,
				target: { host: 'localhost', port: this.port },
				cookiePathRewrite: {
					'http://localhost:3800/public': `${this.serverConfig.uiHostName}:${this.port}/public`
				}
			};

			// Enable secure proxy if configured
			if (this.serverConfig.setting.secureProxy.enable) {
				proxyOptions.ssl = sslConfig;
				proxyOptions.secure = this.serverConfig.setting.secureProxy.secure;
			}

			this._proxy.web(req, res, proxyOptions);
		});
	}

	protected createServerWithSsl(sslConfig: ISsl): void {
		this.server = this.serverFactory.createServer(sslConfig, this.app);
	}

	protected setupIpcMain(): void {
		ipcMain.removeAllListeners('check_ssl');
		ipcMain.on('check_ssl', (event) => {
			this.checkSsl(event);
		});
	}

	protected checkSsl(event: IpcMainEvent): void {
		try {
			const sslConfig = this.sslFactory.createSslConfig(this.serverConfig.setting.secureProxy);
			const server = this.serverFactory.createServer(sslConfig, this.app);

			server.on('error', (error) => {
				console.error(`Server error: ${error}`);
				event.sender.send('check_ssl', { status: false, message: `Server error: ${error}` });
			});

			server.listen(LOCAL_SERVER_UPDATE_CONFIG.TEST_SSL_PORT, () => {
				console.log(`Key and certificate are valid`);
				server.close();
				event.sender.send('check_ssl', { status: true, message: `Key and certificate are valid` });
			});
		} catch (error) {
			console.error(`Error in SSL configuration: ${error}`);
			event.sender.send('check_ssl', { status: false, message: `Error in SSL configuration: ${error}` });
		}
	}
}
