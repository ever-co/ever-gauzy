import express, { Express } from 'express';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { ILocalServer } from '../interfaces';

export class StaticServer implements ILocalServer {
	private _app: Express;
	private _port: number;
	private _isRunning: boolean;
	private _server: Server<typeof IncomingMessage, typeof ServerResponse>;

	protected constructor() {
		this._app = express();
		this._port = 80;
		this._isRunning = false;
	}

	public kill() {
		if (this.running) this.stop();
	}

	public start(): void {
		this._server = this._app.listen(this._port, () => {
			console.log(
				`⚡️[server]: Server is running at https://localhost:${this._port} 🚀`
			);
			this._isRunning = true;
		});
	}

	public stop(): void {
		this._server.close((error: Error) => {
			if (error) {
				console.log('[Error close server]', error);
			} else {
				console.log('🙅‍♂️[server]: Server is stopped');
				this._isRunning = false;
			}
		});
	}

	public get running(): boolean {
		return this._isRunning;
	}

	protected get app(): Express {
		return this._app;
	}

	public get port(): number {
		return this._port;
	}

	public set port(value: number) {
		this._port = value;
	}

	protected get server(): Server<typeof IncomingMessage, typeof ServerResponse> {
		return this._server;
	}
}
