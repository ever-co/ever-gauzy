jest.mock('../environments/environment', () => ({
	environment: {
		baseUrl: 'http://127.0.0.1:9',
		apiTimeout: 5000,
		debug: false,
		auth: { autoLogin: false, email: 'operator@example.com', password: 'operator-password' }
	}
}));

import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { apiClient } from './api-client';
import { runWithAuthKey } from './auth-context';
import { authManager } from './auth-manager';

/**
 * The API's tenant guard reads the tenant from the `Tenant-Id` header, else on a read from a top-level `tenantId` in
 * the query. A list query keeps the tenant inside `where`, so without the header every such read was refused (403).
 * The client now sends the tenant of the login whose token the request carries, on every call, as the web app does.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`; the environment is mocked here for the
 * GAUZY_AUTO_LOGIN account's credentials.
 */

const OPERATOR_TENANT = '00000000-0000-4000-8000-0000000000a1';
const LINA_TENANT = '00000000-0000-4000-8000-0000000000b1';
const NAMED_TENANT = '00000000-0000-4000-8000-0000000000c1';

/** An unsigned token the client reads an expiry from, an hour ahead. */
const tokenOf = (name: string) =>
	[
		Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
		Buffer.from(JSON.stringify({ sub: name, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
		'signature'
	].join('.');

const ACCOUNTS: Record<string, { token: string; tenantId: string }> = {
	'operator@example.com': { token: tokenOf('operator'), tenantId: OPERATOR_TENANT },
	'lina@example.com': { token: tokenOf('lina'), tenantId: LINA_TENANT }
};

interface Recorded {
	path: string;
	authorization?: string;
	/** Every tenant header received, under the name it was sent with. */
	tenantHeaders: Array<[string, string]>;
}

/** The API's auth routes, and any other route answering `{}`, recording what each request carried. */
class ApiStandIn {
	readonly requests: Recorded[] = [];
	private server: Server | null = null;

	async start(): Promise<string> {
		this.server = createServer((req, res) => void this.handle(req, res));
		await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
		return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
	}

	async stop(): Promise<void> {
		this.server?.closeAllConnections();
		await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
	}

	/** The last request made to a path. */
	last(path: string): Recorded {
		return this.requests.filter((request) => request.path === path).pop() as Recorded;
	}

	private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const raw = await new Promise<string>((resolve) => {
			let data = '';
			req.setEncoding('utf8');
			req.on('data', (chunk) => (data += chunk));
			req.on('end', () => resolve(data));
		});
		const path = new URL(req.url ?? '/', 'http://stand-in').pathname;
		const tenantHeaders: Array<[string, string]> = [];
		for (let i = 0; i < req.rawHeaders.length; i += 2) {
			if (req.rawHeaders[i].toLowerCase() === 'tenant-id') {
				tenantHeaders.push([req.rawHeaders[i], req.rawHeaders[i + 1]]);
			}
		}
		this.requests.push({ path, authorization: req.headers.authorization, tenantHeaders });

		const json = (data: unknown) => {
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
			res.end(JSON.stringify(data));
		};

		if (path === '/api/auth/login') {
			const { email } = JSON.parse(raw) as { email: string };
			const account = ACCOUNTS[email];
			return json({ token: account.token, refresh_token: `refresh-${email}`, user: { id: email, email } });
		}
		if (path === '/api/user/me') {
			const token = req.headers.authorization?.replace('Bearer ', '');
			const account = Object.values(ACCOUNTS).find((candidate) => candidate.token === token);
			return json({ tenantId: account?.tenantId, employee: { organizationId: 'organization' } });
		}
		return json({});
	}
}

const standIn = new ApiStandIn();

/** Reads a list route as the current caller, and returns what the request carried. */
const readTasks = async (): Promise<Recorded> => {
	await apiClient.get('/api/tasks', { params: { where: { organizationId: 'organization' } } });
	return standIn.last('/api/tasks');
};

/** The sessions the tests sign in or read as, cleared after each test with the process-wide login. */
const SESSIONS = ['session-lina', 'session-local', 'session-remote'];

/** Signs the GAUZY_AUTO_LOGIN account in, process-wide, as the server does at startup. */
const signInAutoLoginAccount = async () => {
	expect(await apiClient.login()).toEqual({ success: true });
};

/** Signs Lina in on her own session, and reads the list as that session. */
const readTasksAsLina = () =>
	runWithAuthKey(
		'session-lina',
		async () => {
			await apiClient.login('lina@example.com', 'lina-password');
			return readTasks();
		},
		{ sharesAutoLogin: true }
	);

describe('GauzyApiClient — the tenant of the signed-in session on every request', () => {
	beforeAll(async () => {
		apiClient.configure({ baseUrl: await standIn.start() });
	});

	afterAll(async () => {
		await standIn.stop();
	});

	// Each test signs in what it needs, so it runs alone as it does in the suite.
	afterEach(async () => {
		for (const session of SESSIONS) {
			authManager.clearKey(session);
		}
		await apiClient.logout();
		standIn.requests.length = 0;
	});

	it('sends no tenant while nobody is signed in', async () => {
		const request = await readTasks();

		expect(request.authorization).toBeUndefined();
		expect(request.tenantHeaders).toEqual([]);
	});

	it("sends the signed-in user's tenant with their token, in the header the tenant guard reads", async () => {
		await signInAutoLoginAccount();

		const request = await readTasks();

		expect(request.authorization).toBe(`Bearer ${ACCOUNTS['operator@example.com'].token}`);
		expect(request.tenantHeaders).toEqual([['Tenant-Id', OPERATOR_TENANT]]);
	});

	it('keeps a tenant the caller set, in any casing', async () => {
		await signInAutoLoginAccount();

		await apiClient.get('/api/tasks', { headers: { 'Tenant-Id': NAMED_TENANT } });
		expect(standIn.last('/api/tasks').tenantHeaders).toEqual([['Tenant-Id', NAMED_TENANT]]);

		await apiClient.get('/api/tasks', { headers: { 'tenant-id': NAMED_TENANT } });
		expect(standIn.last('/api/tasks').tenantHeaders).toEqual([['tenant-id', NAMED_TENANT]]);
	});

	it("sends a session's own tenant once it signs in, never the auto-login account's", async () => {
		await signInAutoLoginAccount();

		const request = await readTasksAsLina();

		expect(request.authorization).toBe(`Bearer ${ACCOUNTS['lina@example.com'].token}`);
		expect(request.tenantHeaders).toEqual([['Tenant-Id', LINA_TENANT]]);
		// The sign-in's own read carries the new token: it gets no tenant of the login it replaces.
		expect(standIn.last('/api/user/me').tenantHeaders).toEqual([]);
	});

	it('sends the auto-login account its own tenant for a caller on this machine without a login', async () => {
		await signInAutoLoginAccount();

		const request = await runWithAuthKey('session-local', readTasks, { sharesAutoLogin: true });

		expect(request.authorization).toBe(`Bearer ${ACCOUNTS['operator@example.com'].token}`);
		expect(request.tenantHeaders).toEqual([['Tenant-Id', OPERATOR_TENANT]]);
	});

	it('sends no tenant for a caller from elsewhere without a login, though the auto-login account is signed in', async () => {
		await signInAutoLoginAccount();

		const request = await runWithAuthKey('session-remote', readTasks, { sharesAutoLogin: false });

		expect(request.authorization).toBeUndefined();
		expect(request.tenantHeaders).toEqual([]);
	});

	it('sends no tenant once a session signs out, though the auto-login account is still signed in', async () => {
		await signInAutoLoginAccount();
		const signedIn = await readTasksAsLina();
		expect(signedIn.tenantHeaders).toEqual([['Tenant-Id', LINA_TENANT]]);

		const request = await runWithAuthKey(
			'session-lina',
			async () => {
				await apiClient.logout();
				return readTasks();
			},
			{ sharesAutoLogin: true }
		);

		expect(request.authorization).toBeUndefined();
		expect(request.tenantHeaders).toEqual([]);
	});
});
