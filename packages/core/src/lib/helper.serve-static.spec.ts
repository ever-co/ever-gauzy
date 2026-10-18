import 'reflect-metadata';
import * as express from 'express';
import * as fsp from 'node:fs/promises';
import { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { resolveServeStaticPath } from './helper';
import { generateImportArchiveFileName } from './export-import/import/import-archive-file-name';

/**
 * Uploaded import archives are full tenant data dumps and are kept for re-download. With the local
 * storage provider they live under the asset root that `ServeStaticModule` publishes WITHOUT
 * authentication at `/public/`. They are named as dotfiles so the static server refuses them even to
 * somebody who has the name; this suite drives the real `express.static` with the application's own
 * serve-static options to prove it, so a later change to those options cannot quietly re-publish them.
 */
describe('serving /public/ (import archives)', () => {
	let root: string;
	let baseUrl: string;
	let server: import('node:http').Server;
	const archiveName = generateImportArchiveFileName();
	// Loading the helper and starting a server is quick alone, but the shared CI runner can take longer than
	// jest's default 5 s for a hook when it runs many suites at once.
	const HOOK_TIMEOUT_MS = 30_000;
	const previousMaxAge = process.env.PUBLIC_ASSETS_MAX_AGE_SECONDS;

	beforeAll(async () => {
		process.env.PUBLIC_ASSETS_MAX_AGE_SECONDS = '3600';
		root = await fsp.mkdtemp(path.join(os.tmpdir(), 'gauzy-public-'));
		await fsp.mkdir(path.join(root, 'import'), { recursive: true });
		await fsp.writeFile(path.join(root, 'import', archiveName), 'PK tenant dump');
		await fsp.writeFile(path.join(root, 'import', 'import-1757000000-123.zip'), 'PK legacy name');

		const [options] = await resolveServeStaticPath({ assetOptions: { assetPublicPath: root } } as any);
		// Mounted the way `@nestjs/serve-static`'s Express loader mounts it.
		const app = express();
		app.use(options.serveRoot, express.static(options.rootPath, options.serveStaticOptions as any));

		await new Promise<void>((resolve) => {
			server = app.listen(0, '127.0.0.1', () => resolve());
		});
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}, HOOK_TIMEOUT_MS);

	afterAll(async () => {
		if (previousMaxAge === undefined) {
			delete process.env.PUBLIC_ASSETS_MAX_AGE_SECONDS;
		} else {
			process.env.PUBLIC_ASSETS_MAX_AGE_SECONDS = previousMaxAge;
		}
		if (server) {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
		if (root) {
			await fsp.rm(root, { recursive: true, force: true });
		}
	}, HOOK_TIMEOUT_MS);

	it('does not serve an uploaded import archive, even to a caller who knows its name', async () => {
		const response = await fetch(`${baseUrl}/public/import/${archiveName}`);

		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain('tenant dump');
	});

	it('control: an ordinary file in the same directory IS served, so the 404 above is the dotfile rule', async () => {
		const response = await fetch(`${baseUrl}/public/import/import-1757000000-123.zip`);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('PK legacy name');
	});

	it('lets only the browser keep a served file (private), never a shared cache that outlives its deletion', async () => {
		const response = await fetch(`${baseUrl}/public/import/import-1757000000-123.zip`);

		expect(response.status).toBe(200);
		// PUBLIC_ASSETS_MAX_AGE_SECONDS=3600 (beforeAll); serve-static's own header would be `public, max-age=0`.
		expect(response.headers.get('cache-control')).toBe('private, max-age=3600');
		await response.text();
	});
});
