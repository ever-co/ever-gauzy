import * as express from 'express';
import { ILocalUpdateServer } from '../interfaces';
import { StaticServer } from './static-server';
import { LOCAL_SERVER_UPDATE_CONFIG } from '../config';

export class UpdateStaticServer extends StaticServer implements ILocalUpdateServer {
	private static _instance: UpdateStaticServer;

	private constructor() {
		super();
		this.port = LOCAL_SERVER_UPDATE_CONFIG.PORT;
		this.app.use(express.static('public')); // Initialize
		this.app.use(
			'/download',
			express.static(LOCAL_SERVER_UPDATE_CONFIG.FOLDER_PATH)
		);
	}

	public static get instance(): UpdateStaticServer {
		if (!this._instance) {
			this._instance = new UpdateStaticServer();
		}
		return this._instance;
	}

	public kill() {
		UpdateStaticServer._instance = null;
		super.kill();
	}
}
