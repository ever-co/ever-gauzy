import * as express from 'express';
import * as http from 'http';
import { AddressInfo } from 'net';
import { OAuth2AuthorizationServer } from './oauth-authorization-server';

/**
 * The MCP server asks the introspection endpoint about each bearer token it is shown, at most once a minute per token,
 * and from one address. The endpoint shared the 100 requests per 15 minutes of every other endpoint: seven
 * continuously active users used that up, and the MCP server then refused every request as if its token were invalid.
 *
 * Introspection now has budgets of its own. Requests refused for their client credentials keep the old budget, so
 * guessing the resource server's secret is no cheaper. The limiters are the server's own, mounted in front of a
 * stand-in handler (the server is built without its constructor, which mounts the whole Express app).
 */
describe('OAuth2AuthorizationServer — introspection rate limits', () => {
	const ENDPOINT = '/oauth2/introspect';
	const RESOURCE_SERVER = 'resource-server';

	let server: any;
	let listener: http.Server;
	let base: string;

	beforeAll(async () => {
		server = Object.create(OAuth2AuthorizationServer.prototype);
		server.config = { introspectionEndpoint: ENDPOINT };
		const { requests, failedAuthentications } = server.createIntrospectionRateLimits();

		// Answers 200 to the resource server and 401 to any other client, as the endpoint does
		const app = express();
		app.post(ENDPOINT, requests, failedAuthentications, (req, res) => {
			res.status(req.headers['x-client'] === RESOURCE_SERVER ? 200 : 401).json({});
		});
		listener = app.listen(0, '127.0.0.1');
		await new Promise((resolve) => listener.once('listening', resolve));
		base = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise((resolve) => listener.close(resolve));
	});

	const introspect = (client: string) =>
		new Promise<number>((resolve, reject) => {
			const request = http.request(
				`${base}${ENDPOINT}`,
				{ method: 'POST', agent: false, headers: { 'x-client': client } },
				(res) => {
					res.resume();
					res.on('end', () => resolve(res.statusCode ?? 0));
				}
			);
			request.on('error', reject);
			request.end();
		});

	it('answers the resource server well past the budget the other endpoints share', async () => {
		for (let i = 0; i < 150; i++) {
			expect(await introspect(RESOURCE_SERVER)).toBe(200);
		}
	});

	it('still allows only 100 requests refused for their client credentials per 15 minutes', async () => {
		for (let i = 0; i < 100; i++) {
			expect(await introspect('guesser')).toBe(401);
		}

		expect(await introspect('guesser')).toBe(429);
	});

	it('leaves only introspection requests out of the budget the other endpoints share', () => {
		const request = (method: string, path: string) => ({ method, path }) as any;

		expect(server.isIntrospectionRequest(request('POST', ENDPOINT))).toBe(true);
		expect(server.isIntrospectionRequest(request('GET', ENDPOINT))).toBe(false);
		expect(server.isIntrospectionRequest(request('POST', '/oauth2/token'))).toBe(false);
		expect(server.isIntrospectionRequest(request('POST', '/oauth2/register'))).toBe(false);
	});
});
