import { LOCAL_SERVER_UPDATE_CONFIG } from '../config';
import { ILocalUpdateServer } from '../interfaces';
import { StaticServer } from './static-server';

export class DesktopLocalUpdateServer implements ILocalUpdateServer {
	private _port: number;
	private _server: StaticServer;

	constructor() {
		this._port = LOCAL_SERVER_UPDATE_CONFIG.PORT;
		this._server = StaticServer.instance;
	}

	public start(): void {
		if (this.running) return;
		try {
			this._server.start();
			console.log('👂 Listern to localhost:', this._port);
		} catch (error) {
			console.log('Error on start update server', error);
		}
	}

	public stop(): void {
		if (this.running) {
			setTimeout(() => {
				this._server.stop();
			}, 3000);
		}
	}

	public get running(): boolean {
		return this._server.running;
	}

	public fileUri(uri: string) {
		LOCAL_SERVER_UPDATE_CONFIG.FOLDER_PATH = uri;
	}

	public restart() {
		StaticServer.instance.kill();
		this._server = StaticServer.instance;
		this.start();
	}
}
