import { IServerFactory } from '../interfaces';
import { createServer, Server } from 'https';
import { ISsl } from '@gauzy/contracts';
import { Express } from 'express';

export class ServerFactory implements IServerFactory {
	public createServer(sslConfig: ISsl, app: Express): Server {
		try {
			return createServer(sslConfig, app);
		} catch (error) {
			console.error('ERROR: Creating HTTPS server:', error);
			throw error;
		}
	}
}
