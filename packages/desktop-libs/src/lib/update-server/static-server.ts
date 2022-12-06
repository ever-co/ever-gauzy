import express, { Express } from 'express';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { ILocalUpdateServer } from 'lib/interfaces';
import { LOCAL_SERVER_UPDATE_CONFIG } from '../config';

export class StaticServer implements ILocalUpdateServer {
	private _app: Express;
	private _port: number;
	private _isRunning: boolean;
	private _server: Server<typeof IncomingMessage, typeof ServerResponse>;
	private static _instance: StaticServer;

	private constructor() {
		this._app = express();
		this._port = LOCAL_SERVER_UPDATE_CONFIG.PORT;
		this._app.use(express.static('public')); // Initialize
		this._app.use(
			'/download',
			express.static(LOCAL_SERVER_UPDATE_CONFIG.FOLDER_PATH)
		);
		this._isRunning = false;
	}

	public static get instance(): StaticServer {
		if (!this._instance) {
			this._instance = new StaticServer();
		}
		return this._instance;
	}

	public kill() {
		StaticServer._instance = null;
		if(this.running) this.stop();
	}

	public start(): void {
		this._server = this._app.listen(this._port, () => {
			console.log(
				`⚡️[server]: Update server is running at https://localhost:${this._port} 🚀`
			);
			this._isRunning = true;
		});
	}

	public stop(): void {
		this._server.close((error: Error) => {
			if (error) {
				console.log('[Error close server]', error);
			} else {
				console.log('🙅‍♂️[server]: Update server is stopped');
				this._isRunning = false;
			}
		});
	}

	public get running(): boolean {
		return this._isRunning;
	}
}
