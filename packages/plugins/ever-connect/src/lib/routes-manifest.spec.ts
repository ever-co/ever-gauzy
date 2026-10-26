import { Controller, Get, RequestMethod, Type, UseGuards } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { EverConnectModule } from './ever-connect.module';
import { EverConnectEnabledGuard, EverConnectOperatorGuard } from './guards/ever-connect-operator.guard';

const MANIFEST = join(__dirname, '../../ever-connect.routes.json');

interface Route {
	method: string;
	path: string;
}

const join_ = (...parts: string[]) =>
	'/' +
	parts
		.flatMap((part) => part.split('/'))
		.filter((segment) => segment.length > 0)
		.join('/');

/**
 * Every route of `controllers` that is behind neither Gauzy's organization permission guards nor the
 * operator check: the module's public or signed-in-only endpoints, which the manifest must declare.
 */
export function specialRoutes(controllers: Array<Type<unknown>>, prefix = '/api'): Route[] {
	const routes: Route[] = [];
	for (const controller of controllers) {
		const classGuards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as unknown[];
		const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
		for (const name of Object.getOwnPropertyNames(controller.prototype)) {
			const handler = Object.getOwnPropertyDescriptor(controller.prototype, name)?.value;
			if (
				name === 'constructor' ||
				typeof handler !== 'function' ||
				Reflect.getMetadata(PATH_METADATA, handler) === undefined
			)
				continue;
			const guards = [...classGuards, ...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as unknown[])];
			const guarded =
				guards.includes(TenantPermissionGuard) ||
				guards.includes(PermissionGuard) ||
				guards.includes(EverConnectOperatorGuard);
			if (guarded) continue;
			const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number] ?? 'GET';
			for (const path of ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, handler))) {
				routes.push({ method, path: join_(prefix, base, String(path)) });
			}
		}
	}
	return routes.sort((a, b) => (a.path + a.method < b.path + b.method ? -1 : 1));
}

/**
 * `ever-connect.routes.json` declares every endpoint of this module that answers without an
 * organization permission or the operator check. It must equal the routes the module registers when
 * every optional route is mounted (`EVER_STATS_SERVES=gauzy,teams`); the requests Ever Platform will
 * make to an installation are declared as not mounted in this release. `UPDATE_ROUTES_MANIFEST=1`
 * rewrites the method and path list; the descriptions stay hand-written.
 */
describe('route manifest', () => {
	const controllers = (env: Record<string, string>) =>
		EverConnectModule.register(env).controllers as Array<Type<unknown>>;
	const registered = () => specialRoutes(controllers({ EVER_STATS_SERVES: 'gauzy,teams' }));

	it('declares exactly the special routes the module registers', () => {
		const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
		if (process.env['UPDATE_ROUTES_MANIFEST'] === '1') {
			const known = new Map(manifest.public_endpoints.map((e: Route) => [`${e.method} ${e.path}`, e]));
			manifest.public_endpoints = registered().map(
				(r) => known.get(`${r.method} ${r.path}`) ?? { method: r.method, path: r.path, auth: 'signed_in' }
			);
			writeFileSync(MANIFEST, JSON.stringify(manifest, null, '\t') + '\n');
		}
		expect(manifest.public_endpoints.map((e: Route) => ({ method: e.method, path: e.path }))).toEqual(registered());
		expect(manifest.platform_requests.every((r: { mounted: boolean }) => r.mounted === false)).toBe(true);
		expect(manifest.platform_requests.map((r: Route) => `${r.method} ${r.path}`)).toEqual([
			'GET /api/ever-connect/usage',
			'GET /api/ever-connect/provision',
			'POST /api/ever-connect/provision'
		]);
	});

	it('health is signed-in only (never @Public) and mounted only on a paired installation', () => {
		expect(registered()).toEqual([{ method: 'GET', path: '/api/ever-connect/health' }]);
		expect(specialRoutes(controllers({}))).toEqual([]);
		const health = controllers({ EVER_STATS_SERVES: 'gauzy,teams' }).find(
			(c) => c.name === 'EverConnectHealthController'
		) as Type<unknown>;
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, health)).toBeUndefined();
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, health.prototype.health)).toBeUndefined();
	});

	it('a declared platform route is not mounted (no usage or provision route in this release)', () => {
		const all = controllers({ EVER_STATS_SERVES: 'gauzy,teams' }).flatMap((c) =>
			Object.getOwnPropertyNames(c.prototype).map((name) =>
				String(Reflect.getMetadata(PATH_METADATA, c.prototype[name] ?? {}) ?? '')
			)
		);
		expect(all.filter((path) => /usage|provision/.test(path))).toEqual([]);
	});

	it('fails when an unguarded route is added without an entry (control)', () => {
		@UseGuards(EverConnectEnabledGuard)
		@Controller('/ever-connect')
		class PlantedController {
			@Get('debug')
			debug() {
				return {};
			}
		}
		const withPlanted = specialRoutes([...controllers({ EVER_STATS_SERVES: 'gauzy,teams' }), PlantedController]);
		expect(withPlanted).toContainEqual({ method: 'GET', path: '/api/ever-connect/debug' });
		expect(withPlanted).not.toEqual(registered());
	});
});
