import { StaticFileServer } from './static-file-server';

export class ServerManager {
	private staticFileServer: StaticFileServer;

	public constructor() {
		this.staticFileServer = StaticFileServer.getInstance();
	}

	public runServer(port: number) {
		try {
			 this.staticFileServer.startServer(port);
		} catch (error) {
			console.error('[CRITICAL::ERROR]: Starting server:', error);
		}
	}
}
