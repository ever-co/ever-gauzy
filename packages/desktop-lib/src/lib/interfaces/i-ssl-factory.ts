import { ISsl } from '@gauzy/contracts';
import { Express } from 'express';
import { Server } from 'http';

export interface IServerFactory {
	createServer(sslConfig: ISsl, app: Express): Server;
}
