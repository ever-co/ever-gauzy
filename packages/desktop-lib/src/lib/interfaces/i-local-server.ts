import { ILocalUpdateServer } from './i-local-update-server';

export interface ILocalServer extends ILocalUpdateServer {
	port: number;
};
