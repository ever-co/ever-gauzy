import * as http from 'http';
import * as path from 'path';
import { parse } from 'url';
import { Server as NodeStaticServer } from 'node-static';
import { IncomingMessage, ServerResponse } from 'http';

export class StaticFileServer {
	private static instance: StaticFileServer;
	private fileServer: NodeStaticServer;
	private isPackaged: boolean;
	private dirUi: string;

	private constructor() {
		this.isPackaged = process.env.isPackaged === 'true';
		this.dirUi = this.isPackaged
			? path.join(__dirname, '..', '..', 'data', 'ui')
			: path.join(__dirname, '..', 'data', 'ui');
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

	public startServer(port: number): void {
		const server = http.createServer((req, res) => this.serveFile(req, res));

		server.on('listening', () => {
			console.log(`Listening on port ${port}`);
		});

		server.on('error', (error: Error) => {
			console.error(`[CRITICAL::ERROR]: Server error: ${error}`);
		});

		server.listen(port, '0.0.0.0');
	}

	public static getInstance(): StaticFileServer {
		if (!StaticFileServer.instance) {
			StaticFileServer.instance = new StaticFileServer();
		}
		return StaticFileServer.instance;
	}
}
