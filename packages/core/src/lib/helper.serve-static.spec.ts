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

	beforeAll(async () => {
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
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await fsp.rm(root, { recursive: true, force: true });
	});

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
});
