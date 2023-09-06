import { LOCAL_SERVER_UPDATE_CONFIG } from '../config';
import { ILocalUpdateServer } from '../interfaces';
import { UpdateStaticServer } from '../server';

export class DesktopLocalUpdateServer implements ILocalUpdateServer {
	private _port: number;
	private _server: UpdateStaticServer;

	constructor() {
		this._port = LOCAL_SERVER_UPDATE_CONFIG.PORT;
		this._server = UpdateStaticServer.instance;
	}

	public start(): void {
		if (this.running) return;
		try {
			this._server.start();
			console.log('👂 Listen to localhost:', this._port);
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
		UpdateStaticServer.instance.kill();
		this._server = UpdateStaticServer.instance;
		this.start();
	}
}
