// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Only the
// token helpers are needed, loaded from their own file; the other collaborators are stand-ins.
jest.mock('@gauzy/core', () => {
	const helpers = jest.requireActual('../../../../core/src/lib/auth/purpose-token');
	return { isAccessTokenPayload: helpers.isAccessTokenPayload, JWT_ALGORITHMS: helpers.JWT_ALGORITHMS };
});
jest.mock('@ever-gauzy/plugin-integration-plane-api', () => ({
	mountPlaneProxy: jest.fn(),
	readSessionTokenFromCookieHeader: jest.fn()
}));
jest.mock('./plane-integration.service', () => ({ PlaneIntegrationService: class PlaneIntegrationService {} }));

import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mountPlaneProxy } from '@ever-gauzy/plugin-integration-plane-api';
import { PlaneProxyService } from './plane-proxy.service';
import { PLANE_PROXY_UPSTREAM_URL_ENV, resolvePlaneProxyUpstreamUrl } from './plane-proxy-upstream';

const v4 = (address: string, port: number): AddressInfo => ({ address, port, family: 'IPv4' });
const v6 = (address: string, port: number): AddressInfo => ({ address, port, family: 'IPv6' });

const PUBLIC_BASE = 'https://api.example.com';
const resolve = (address: AddressInfo | string | null, override?: string, port: number | string = 9999) =>
	resolvePlaneProxyUpstreamUrl({ address, override, port, publicBaseUrl: PUBLIC_BASE });

/**
 * The proxy runs inside the API process, but it used to call Gauzy on the public API_BASE_URL, so every
 * pm.gauzy.co call left the pod, went through Cloudflare and came back in. When that egress path
 * faltered, the proxy answered 500 "Upstream API unreachable: connect ETIMEDOUT <Cloudflare IP>:443".
 */
describe('resolvePlaneProxyUpstreamUrl', () => {
	it.each([
		['a wildcard IPv4 bind', v4('0.0.0.0', 3000), 'http://127.0.0.1:3000/api'],
		['a wildcard IPv6 bind', v6('::', 3000), 'http://[::1]:3000/api'],
		['a loopback bind', v4('127.0.0.1', 3100), 'http://127.0.0.1:3100/api'],
		['a specific IPv4 bind', v4('10.0.0.5', 3000), 'http://10.0.0.5:3000/api'],
		['a specific IPv6 bind', v6('fd00::5', 3000), 'http://[fd00::5]:3000/api']
	])('dials the server itself for %s', (_label, address, expected) => {
		expect(resolve(address)).toBe(expected);
	});

	it('falls back to loopback on the configured port before the server listens', () => {
		expect(resolve(null, undefined, 3000)).toBe('http://127.0.0.1:3000/api');
		expect(resolve(null, undefined, '3200')).toBe('http://127.0.0.1:3200/api');
	});

	it('keeps the public URL for a server on a pipe or Unix socket, which a URL cannot dial', () => {
		expect(resolve('/run/gauzy.sock')).toBe('https://api.example.com/api');
		expect(resolve('\\\\.\\pipe\\gauzy')).toBe('https://api.example.com/api');
		expect(resolve('/run/gauzy.sock', 'http://gauzy-api.svc:3000')).toBe('http://gauzy-api.svc:3000/api');
	});

	it.each([
		['https://api.example.com', 'https://api.example.com/api'],
		['https://api.example.com/', 'https://api.example.com/api'],
		['https://api.example.com/api', 'https://api.example.com/api'],
		[' http://gauzy-api.svc:3000/api/ ', 'http://gauzy-api.svc:3000/api']
	])('PLANE_PROXY_UPSTREAM_URL=%j wins over the server address', (override, expected) => {
		expect(resolve(v4('0.0.0.0', 3000), override)).toBe(expected);
	});

	it('ignores a blank PLANE_PROXY_UPSTREAM_URL', () => {
		expect(resolve(v4('0.0.0.0', 3000), '  ')).toBe('http://127.0.0.1:3000/api');
	});

	it.each(['0.0.0.0', '127.0.0.1'])('reaches a real server bound to %s', async (host) => {
		const server = http.createServer((req, res) => res.end(req.url));
		await new Promise<void>((resolve) => server.listen(0, host, resolve));
		try {
			const url = resolve(server.address(), undefined, 1);
			const body = await new Promise<string>((resolve, reject) => {
				http.get(`${url}/health`, (res) => {
					let data = '';
					res.on('data', (chunk) => (data += chunk));
					res.on('end', () => resolve(data));
				}).on('error', reject);
			});
			expect(body).toBe('/api/health');
		} finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});

describe('PlaneProxyService upstream', () => {
	const PUBLIC_API = 'https://api.gauzy.co/api';
	const REQ_TENANT_ID = '__planeResolvedTenantId';

	let resolveConfig: (req: any) => Promise<{ externalBaseApiUrl: string }>;

	beforeEach(async () => {
		delete process.env[PLANE_PROXY_UPSTREAM_URL_ENV];
		(mountPlaneProxy as jest.Mock).mockReset();

		const httpServer = { address: () => v4('0.0.0.0', 3000) };
		const httpAdapterHost: any = { httpAdapter: { getHttpServer: () => httpServer } };
		const planeIntegrationService: any = {
			getConfigForTenant: async () => ({
				externalBaseApiUrl: PUBLIC_API,
				apiKey: 'k',
				apiSecret: 's',
				clientBaseUrl: 'https://pm.example.com',
				clientAdminUrl: '',
				clientSpaceUrl: ''
			})
		};

		const service = new PlaneProxyService(httpAdapterHost, planeIntegrationService);
		Object.assign(service, { logger: { warn: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn() } });
		await service.onModuleInit();

		resolveConfig = (mountPlaneProxy as jest.Mock).mock.calls[0][1].resolveConfig;
	});

	afterAll(() => {
		delete process.env[PLANE_PROXY_UPSTREAM_URL_ENV];
	});

	it("calls a tenant's Gauzy over loopback, not the public URL", async () => {
		const config = await resolveConfig({ [REQ_TENANT_ID]: 't1' });
		expect(config.externalBaseApiUrl).toBe('http://127.0.0.1:3000/api');
		// The rest of the tenant's settings still come from the database.
		expect(config).toMatchObject({ apiKey: 'k', clientBaseUrl: 'https://pm.example.com' });
	});

	it('calls Gauzy over loopback for tenant-less bootstrap requests', async () => {
		expect((await resolveConfig({})).externalBaseApiUrl).toBe('http://127.0.0.1:3000/api');
	});

	it('honours PLANE_PROXY_UPSTREAM_URL, e.g. to restore the public URL', async () => {
		process.env[PLANE_PROXY_UPSTREAM_URL_ENV] = 'https://api.gauzy.co';
		expect((await resolveConfig({ [REQ_TENANT_ID]: 't1' })).externalBaseApiUrl).toBe(PUBLIC_API);
		expect((await resolveConfig({})).externalBaseApiUrl).toBe(PUBLIC_API);
	});
});
