import { Controller, Get, Type } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Public } from '@gauzy/common';
import { EverStatsModule } from './ever-stats.module';
import { collectPublicRoutes } from './routes-manifest';

const MANIFEST = join(__dirname, '../../ever-connect.routes.json');

/**
 * `ever-connect.routes.json` declares every route of this module that answers without
 * authentication. It must equal the routes the module registers when every optional route is mounted
 * (`EVER_STATS_SERVES=gauzy,teams`). `UPDATE_ROUTES_MANIFEST=1` rewrites the method and path list;
 * the descriptions stay hand-written.
 */
describe('route manifest', () => {
	const registered = () => collectPublicRoutes(EverStatsModule.register({ EVER_STATS_SERVES: 'gauzy,teams' }).controllers as Array<Type<unknown>>);

	it('declares exactly the public routes the module registers', () => {
		const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
		if (process.env['UPDATE_ROUTES_MANIFEST'] === '1') {
			const known = new Map(manifest.public_endpoints.map((e: { method: string; path: string }) => [`${e.method} ${e.path}`, e]));
			manifest.public_endpoints = registered().map((r) => known.get(`${r.method} ${r.path}`) ?? { method: r.method, path: r.path, auth: 'none' });
			writeFileSync(MANIFEST, JSON.stringify(manifest, null, '\t') + '\n');
		}
		const declared = manifest.public_endpoints.map((e: { method: string; path: string }) => ({ method: e.method, path: e.path }));
		expect(declared).toEqual(registered());
		expect(manifest.platform_requests).toEqual([]);
	});

	it('lists only GET /api/ever-stats/state, and nothing on an unpaired installation', () => {
		expect(registered()).toEqual([{ method: 'GET', path: '/api/ever-stats/state' }]);
		expect(collectPublicRoutes(EverStatsModule.register({}).controllers as Array<Type<unknown>>)).toEqual([]);
	});

	it('fails when a public route is added without an entry (control)', () => {
		@Public()
		@Controller('/ever-stats')
		class PlantedController {
			@Get('debug')
			debug() {
				return {};
			}
		}
		const withPlanted = collectPublicRoutes([...(EverStatsModule.register({ EVER_STATS_SERVES: 'gauzy,teams' }).controllers as Array<Type<unknown>>), PlantedController]);
		const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
		expect(withPlanted).not.toEqual(manifest.public_endpoints.map((e: { method: string; path: string }) => ({ method: e.method, path: e.path })));
		expect(withPlanted).toContainEqual({ method: 'GET', path: '/api/ever-stats/debug' });
	});
});
