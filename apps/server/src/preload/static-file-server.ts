import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import { Server as NodeStaticServer } from 'node-static';
import * as path from 'node:path';
import { parse } from 'node:url';

export class StaticFileServer {
	private static instance: StaticFileServer;
	private fileServer: NodeStaticServer;
	private isPackaged: boolean;
	private dirUi: string;

	private constructor() {
		this.isPackaged = process.env.isPackaged === 'true';
		const baseDir = this.isPackaged ? ['..', '..'] : ['..'];
		this.dirUi = path.join(__dirname, ...baseDir, 'data', 'ui');
		this.fileServer = new NodeStaticServer(this.dirUi);
	}

	public serveFile(req: IncomingMessage, res: ServerResponse): void {
		this.fileServer.serve(req, res, (err: any | null, result: any) => {
			if (err) {
				console.error(`Error serving ${req.url} - ${err.message}`);
				res.writeHead(err.status || 500, err.headers || {});
				res.end();
			} else {
				console.log('UI server started');
				console.log(JSON.stringify(parse(req.url || '', true).query));
			}
		});
	}

	/**
	 * @param port - The web UI port.
	 * @param host - The address to listen on: `0.0.0.0` when other computers may connect, else `127.0.0.1`.
	 */
	public startServer(port: number, host: string): void {
		const server = http.createServer((req, res) => this.serveFile(req, res));

		server.on('listening', () => {
			console.log(`Listening on port ${port}`);
		});

		server.on('error', (error: Error) => {
			console.error(`[CRITICAL::ERROR]: Server error: ${error}`);
		});

		server.listen(port, host);
	}

	public static getInstance(): StaticFileServer {
		if (!StaticFileServer.instance) {
			StaticFileServer.instance = new StaticFileServer();
		}
		return StaticFileServer.instance;
	}
}
