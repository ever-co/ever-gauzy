import * as http from 'http';
import { IncomingMessage, ServerResponse } from 'http';
import * as finalhandler from 'finalhandler';
import * as path from 'node:path';
import { parse } from 'node:url';
import * as serveStatic from 'serve-static';
import { isIndexHtmlRequest, serveIndexHtml } from './index-html';

export type StaticFileHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * The variable through which the launcher hands the UI server the web UI's runtime configuration (desktop-lib's
 * `UI_RUNTIME_CONFIG_SCRIPT_ENV`, set by its UiService; this process cannot load desktop-lib).
 */
export const UI_RUNTIME_CONFIG_SCRIPT_ENV = 'UI_RUNTIME_CONFIG_SCRIPT';

/** Options of {@link createStaticFileHandler}. */
export interface StaticFileHandlerOptions {
	/**
	 * HTML inserted into the UI's `index.html` as it is served (see `index-html.ts`): Gauzy Server's runtime
	 * configuration. Without it, `index.html` is served as it is on disk, like every other file.
	 */
	indexHtmlSnippet?: string;
}

/**
 * The request handler of the UI server: serves the files under `root` with serve-static (send).
 *
 * It replaces node-static 0.7.11, which has no fixed release and served this UI on the LAN (`0.0.0.0`): a NUL byte
 * (`GET /%00`) crashed the process, and its root check compared string prefixes only, so `/../ui<x>/…` read the files
 * of a sibling `ui*` directory. send answers the first with 400 and any `..` segment with 403, and never leaves `root`.
 *
 * What the UI sees is unchanged: `index.html` for a directory, a 301 to the trailing-slash URL for a directory asked
 * without one, 404 for a missing file (no SPA fallback, as before), `Cache-Control: max-age=3600`. Errors are answered
 * with their status and no stack trace (`env: 'production'`, whatever NODE_ENV says) and logged as before.
 *
 * With an `indexHtmlSnippet`, `/` and `/index.html` are the exception: the start page is served with the snippet in
 * it and `Cache-Control: no-cache`, from a file that is never written to.
 */
export function createStaticFileHandler(root: string, options: StaticFileHandlerOptions = {}): StaticFileHandler {
	const { indexHtmlSnippet } = options;
	const serve = serveStatic(root, {
		index: ['index.html'],
		redirect: true,
		// Hand every error (400, 403, 404, 405) to finalhandler below, as node-static handed it to our callback.
		fallthrough: false,
		maxAge: '1h'
	});

	return (req: IncomingMessage, res: ServerResponse): void => {
		res.once('finish', () => {
			if (res.statusCode < 400) {
				console.log('UI server started');
				console.log(JSON.stringify(parse(req.url || '', true).query));
			}
		});

		const serveFromDisk = () =>
			serve(
				req,
				res,
				finalhandler(req, res, {
					env: 'production',
					onerror: (err: { message?: string }) => console.error(`Error serving ${req.url} - ${err.message}`)
				})
			);

		if (indexHtmlSnippet && isIndexHtmlRequest(req)) {
			// A start page that cannot be read is answered as before (404 when it is missing).
			serveIndexHtml(root, indexHtmlSnippet, req, res, serveFromDisk);
			return;
		}

		serveFromDisk();
	};
}

export class StaticFileServer {
	private static instance: StaticFileServer;
	private handler: StaticFileHandler;
	private isPackaged: boolean;
	private dirUi: string;

	private constructor() {
		this.isPackaged = process.env.isPackaged === 'true';
		const baseDir = this.isPackaged ? ['..', '..'] : ['..'];
		this.dirUi = path.join(__dirname, ...baseDir, 'data', 'ui');
		this.handler = createStaticFileHandler(this.dirUi, {
			indexHtmlSnippet: process.env[UI_RUNTIME_CONFIG_SCRIPT_ENV]
		});
	}

	public serveFile(req: IncomingMessage, res: ServerResponse): void {
		this.handler(req, res);
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
