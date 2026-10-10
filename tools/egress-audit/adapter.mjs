// Ever Gauzy's adapter for the Ever Platform egress audit (see README.md).
//
// The audit's driver runs the API hooks inside the sealed audit network, so they reach the API by
// its compose service name. The browser hooks (uiLogin, routeParams) run in the audit's browser,
// which reaches the web app and the API by their service names too.
//
// - off modes: what anyone could do without an account: call every route of the anonymous usage
//   statistics with its own method, and require 404 from each.
// - every mode: sign in as the seeded Super Admin and hand the browser the ids it needs for the
//   routes that carry one (never a token).
// - loaded_off: the Super Admin (the instance operator) switches the statistics off in Settings.
// - every_trigger: every trigger of every call this release makes, against the mock platform
//   (connect, link, entitlement refresh, a consent and the operator's accept, the statistics link,
//   switching off, unlink, disconnect); the call log must be exactly the generated rows.
// - connect_off_sign_in_on: the connection off and the Ever ID sign-in plugin on with an issuer on
//   an Ever host: the plugin must not use it (no lookup, no request, no redirect to it).
// - entitlement_ladder: entitlement documents dated so the stored one is in grace, then paused, one
//   issued in the future (refused, the stored one kept) and one slightly ahead (accepted): the
//   ladder follows, and Gauzy's own routes answer the same at every step.
// - browser leg: sign in through the real sign-in page (the harness checks that the sign-in holds:
//   a route that ends on the sign-in page faults the walk).

import { randomBytes } from 'node:crypto';

/** The seeded Super Admin of the audit's throw-away database (compose.egress-audit.yml). */
const SEED_EMAIL = 'admin@example.com';

/**
 * Its password, made for this run where the harness reads the adapter's `env` (the runner) and
 * handed to the API (which seeds it) and to the hooks as `ctx.env.DEMO_SUPER_ADMIN_PASSWORD`. The
 * driver and the browser import this file too; there the value below is unused.
 */
const RUN_SEED = { DEMO_SUPER_ADMIN_PASSWORD: `audit-${randomBytes(18).toString('hex')}` };
const seedPassword = (ctx) => {
	const value = ctx.env?.DEMO_SUPER_ADMIN_PASSWORD;
	if (!value) throw new Error('no seed password in the mode environment (DEMO_SUPER_ADMIN_PASSWORD)');
	return value;
};

/**
 * The pages a person sees before signing in. Signed in, their guard sends the walk to the dashboard,
 * so the browser opens them first, signed out: each as a full page load (a query of its own before
 * the fragment), so the harness records its requests and dumps its links (under the path `/`).
 */
const SIGNED_OUT_ROUTES = [
	'/auth/login',
	'/auth/register',
	'/auth/request-password',
	'/auth/reset-password',
	'/auth/confirm-email',
	'/auth/accept-invite',
	'/auth/accept-client-invite',
	'/auth/estimate',
	'/auth/login-workspace',
	'/auth/login-magic',
	'/auth/magic-sign-in',
	'/auth/ever-id',
	'/auth/ever-id/confirm',
	'/auth/ever-id/signup',
	'/share/workspace/create',
	'/share/workspace/find',
	'/share/workspace/signin',
	'/legal/terms',
	'/legal/privacy',
	'/legal/cookies'
];

/** The route of a web app URL: its fragment without the query (`#/pages/settings`). */
const routeOf = (url) => new URL(url).hash.split('?')[0] || '/';

/**
 * A value for a route parameter that names something the seed does not have: the page still
 * renders around a "not found", which is all the walk needs (what it renders and what it calls).
 */
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** Every statistics route, with the method the settings page (or the paired Ever Teams) uses. */
const STATS_ROUTES = [
	['GET', '/api/ever-stats/status'],
	['GET', '/api/ever-stats/last'],
	['POST', '/api/ever-stats/preview'],
	['PUT', '/api/ever-stats/enabled'],
	['POST', '/api/ever-stats/send-now'],
	['POST', '/api/ever-stats/reset-identity'],
	['GET', '/api/ever-stats/state']
];

/** The modes in which the module is switched off by configuration. */
const OFF_MODES = new Set(['off', 'off_env_file', 'connect_off_sign_in_on']);

/** The mock platform, by its alias on the sealed network (the driver runs the API hooks). */
const MOCK = 'http://mock-platform:8080';

/** The mock's link code: an organization of Ever Platform the operator's organization links to. */
const MOCK_LINK_CODE = 'EVL-TEST-0000-0002';

/**
 * connect_off_sign_in_on: the Ever ID sign-in plugin on, with an issuer on an Ever host and the
 * connection off. On a self-hosted installation only the connection can enable such an issuer, so
 * the plugin must leave it unused.
 */
const SIGN_IN_ON = {
	ZITADEL_ISSUERS: 'https://auth.ever.co',
	ZITADEL_CLIENT_ID: 'gauzy-egress-audit',
	ZITADEL_CLIENT_SECRET: 'egress-audit-not-a-secret'
};

/** entitlement_ladder: the operator connects with the mock's code and the statistics stay off. */
const LADDER = {
	EVER_CONNECT_FEED_MODE: 'interval'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A JSON request to the API with the operator's bearer; answers {status, body}. */
async function api(ctx, method, path, body) {
	const response = await ctx.fetch(`${ctx.baseUrl}${path}`, {
		method,
		redirect: 'manual',
		headers: { ...ctx.auth, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	let parsed = null;
	try {
		parsed = text ? JSON.parse(text) : null;
	} catch {
		parsed = null;
	}
	return { status: response.status, body: parsed, location: response.headers.get('location') };
}

/** A control of the mock platform (`/__mock/<path>`): what app.ever.co or Ever would do. */
async function mock(ctx, path, body) {
	const response = await ctx.fetch(`${MOCK}/__mock/${path}`, {
		method: body === undefined ? 'GET' : 'POST',
		headers: body === undefined ? {} : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const parsed = await response.json().catch(() => null);
	if (response.status >= 300) throw new Error(`mock ${path} answered ${response.status} ${JSON.stringify(parsed)}`);
	return parsed;
}

/** The rows the mock platform recorded so far. */
const recordedRows = async (ctx) => (await mock(ctx, 'requests')).map((entry) => entry.row);

/** Waits until `probe` answers truthy (checked every 2 s), else fails naming `what`. */
async function until(what, probe, seconds = 180) {
	const deadline = Date.now() + seconds * 1000;
	let last;
	while (Date.now() < deadline) {
		last = await probe().catch((error) => ({ error: error.message }));
		if (last && !last.error) return last;
		await sleep(2000);
	}
	throw new Error(`${what} did not happen within ${seconds} s (last: ${JSON.stringify(last)})`);
}

/** Signs in and waits until the installation is connected (EVER_CONNECT_CODE at boot); answers the context. */
async function connected(ctx) {
	const { headers, token, user } = await apiLogin(ctx);
	const session = { ...ctx, auth: headers, organizationId: user.lastOrganizationId ?? organizationOf(token) };
	if (!session.organizationId) throw new Error('the seeded Super Admin has no organization');
	await until('the connection with EVER_CONNECT_CODE', async () => {
		const status = await api(session, 'GET', `/api/ever-connect/status?organizationId=${session.organizationId}`);
		if (status.status !== 200) throw new Error(`status ${status.status}`);
		if (!status.body?.operator) throw new Error('the seeded Super Admin is not the operator');
		return status.body.connected ? status.body : null;
	});
	const state = await mock(session, 'state');
	session.instanceId = state.instances?.[0]?.id;
	if (!session.instanceId) throw new Error('the mock platform has no installation after the connect');
	ctx.log(`adapter: connected (instance ${session.instanceId})`);
	return session;
}

/** Each of Gauzy's own routes the ladder must leave alone, with its status. */
async function coreRoutes(session) {
	const login = await session.fetch(`${session.baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: SEED_EMAIL, password: seedPassword(session) })
	});
	const answers = {
		'GET /api/health': (await api(session, 'GET', '/api/health')).status,
		'POST /api/auth/login': login.status
	};
	for (const path of [
		'/api/user/me',
		`/api/organization/${session.organizationId}`,
		`/api/organization-projects?where[organizationId]=${session.organizationId}`,
		`/api/invoices?where[organizationId]=${session.organizationId}`,
		`/api/timesheet/time-log?organizationId=${session.organizationId}`,
		`/api/organization-contact?where[organizationId]=${session.organizationId}`
	])
		answers[`GET ${path.split('?')[0]}`] = (await api(session, 'GET', path)).status;
	return answers;
}

/**
 * In the off modes a module loaded by mistake must be SEEN: its routes would answer (the public
 * state route exists with `teams` served), and with a short day and an address on the audit
 * network it would try to send within the watched window and look up a name that is not a compose
 * service. (A public address would hold it to one report a day.)
 */
const LOADED_BY_MISTAKE_WOULD_SHOW = {
	EVER_STATS_API_URL: 'https://ever-audit-sink',
	EVER_STATS_SERVES: 'gauzy,teams'
};

/**
 * loaded_off: the module is loaded and on by configuration, and the operator switches it off in
 * Settings once the API is up. Its day is 5 minutes, so the first report would fall due inside the
 * watched window (a few minutes after the switch, during the browser walk): a switch that did not
 * hold would look up `ever-audit-sink`, which is not a compose service.
 */
const LOADED_OFF = {
	EVER_STATS_API_URL: 'https://ever-audit-sink',
	EVER_STATS_SEND_INTERVAL_S: '300',
	EVER_STATS_SERVES: 'gauzy,teams'
};

/** Signs in through the API as the seeded Super Admin; answers the bearer headers and the user. */
async function apiLogin(ctx) {
	const { baseUrl, fetch } = ctx;
	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: SEED_EMAIL, password: seedPassword(ctx) })
	});
	if (response.status !== 200 && response.status !== 201) {
		throw new Error(`the seeded Super Admin could not sign in through the API (${response.status})`);
	}
	const body = await response.json();
	if (!body?.token) throw new Error('the API sign-in answered no token');
	return { headers: { authorization: `Bearer ${body.token}` }, user: body.user ?? {}, token: body.token };
}

/** The organization a token is scoped to (its `organizationId` claim), read without verifying it. */
function organizationOf(token) {
	try {
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
		return typeof payload.organizationId === 'string' ? payload.organizationId : null;
	} catch {
		return null;
	}
}

export default {
	env: {
		off: { ...LOADED_BY_MISTAKE_WOULD_SHOW, ...RUN_SEED },
		off_env_file: { ...LOADED_BY_MISTAKE_WOULD_SHOW, ...RUN_SEED },
		loaded_off: { ...LOADED_OFF, ...RUN_SEED },
		positive_stats: RUN_SEED,
		positive_connect: RUN_SEED,
		every_trigger: RUN_SEED,
		positive_managed: RUN_SEED,
		connect_off_sign_in_on: { ...LOADED_BY_MISTAKE_WOULD_SHOW, ...SIGN_IN_ON, ...RUN_SEED },
		entitlement_ladder: { ...LADDER, ...RUN_SEED }
	},

	/**
	 * every_trigger: each trigger of every call the modules make (the statistics report, row 17,
	 * goes out by itself every 5 s). The installation connected at boot with EVER_CONNECT_CODE
	 * (rows 1, 3, 4, then 6, 7, 8, 9).
	 */
	async triggerAll(ctx) {
		const session = await connected(ctx);
		const org = session.organizationId;
		const expect = (what, answer, statuses) => {
			if (!statuses.includes(answer.status))
				throw new Error(`${what} answered ${answer.status} ${JSON.stringify(answer.body)}`);
			ctx.log(`adapter: ${what}: ${answer.status}`);
			return answer.body;
		};

		// Row 5: the operator's organization links to an Ever organization with a link code.
		const link = expect(
			'link',
			await api(session, 'POST', `/api/ever-connect/links?organizationId=${org}`, { link_code: MOCK_LINK_CODE }),
			[200, 201]
		);

		// Row 8: an on-demand refresh (304: nothing new), then a new document on the platform (200).
		expect(
			'entitlement refresh (unchanged)',
			await api(session, 'POST', `/api/ever-connect/entitlement/refresh?organizationId=${org}`),
			[200]
		);
		await mock(session, 'entitlement/reissue', { instance_id: session.instanceId });
		const refreshed = expect(
			'entitlement refresh (new document)',
			await api(session, 'POST', `/api/ever-connect/entitlement/refresh?organizationId=${org}`),
			[200]
		);
		ctx.log(`adapter: the installation's document is now seq ${refreshed?.instance?.seq}`);

		// Rows 9, 31, 11: the organization consents to the statistics link in app.ever.co; it waits
		// for the operator (read from the event feed, row 7); the operator accepts; the link goes out.
		await mock(session, 'consent', {
			instance_id: session.instanceId,
			integration: 'stats_link',
			operator_accept: 'pending'
		});
		await until('the consent waiting for the operator', async () => {
			const status = await api(session, 'GET', `/api/ever-connect/status?organizationId=${org}`);
			return (status.body?.pending_approvals ?? []).some((p) => p.key === 'stats_link') || null;
		});
		expect(
			'operator accept',
			await api(session, 'POST', '/api/ever-connect/integrations/stats_link/accept', { accepted: true }),
			[200]
		);
		await until(
			'the statistics link (row 11)',
			async () => (await recordedRows(session)).includes(11) || null,
			120
		);

		// Row 10: switched off here, Ever Platform told.
		expect(
			'switch off',
			await api(session, 'PUT', `/api/ever-connect/integrations/stats_link?organizationId=${org}`, {
				enabled: false
			}),
			[200]
		);

		// Row 5 (removal): unlink.
		const linkId = link?.integration_tenant_id ?? link?.integrationTenantId ?? link?.id;
		if (!linkId) throw new Error(`the link answered no id: ${JSON.stringify(Object.keys(link ?? {}))}`);
		expect(
			'unlink',
			await api(session, 'DELETE', `/api/ever-connect/links/${linkId}?organizationId=${org}`),
			[200, 204]
		);

		// Row 16: the operator disconnects.
		expect('disconnect', await api(session, 'POST', '/api/ever-connect/disconnect', { confirm: true }), [200, 201]);
		ctx.log(`adapter: rows so far: ${[...new Set(await recordedRows(session))].sort((a, b) => a - b).join(', ')}`);
	},

	/**
	 * connect_off_sign_in_on: the sign-in plugin is loaded, but the Ever issuer is not used: its
	 * public config offers no Ever ID button and a sign-in start does not redirect to an Ever host.
	 */
	async probeSignIn(ctx) {
		const config = await ctx.fetch(`${ctx.baseUrl}/api/auth/zitadel/config`);
		const body = await config.json().catch(() => null);
		ctx.log(`adapter: sign-in plugin config: ${config.status} ${JSON.stringify(body)}`);
		if (config.status !== 200)
			throw new Error(
				`the sign-in plugin is not loaded (config answered ${config.status}); this mode needs it on`
			);
		const start = await ctx.fetch(`${ctx.baseUrl}/api/auth/zitadel`, { redirect: 'manual' });
		const location = start.headers.get('location') ?? '';
		ctx.log(
			`adapter: sign-in start: ${start.status}${location ? ` to ${new URL(location, ctx.baseUrl).host}` : ''}`
		);
		if (/^https?:\/\/([^/]*\.)?ever\.co(\/|:|$)/i.test(location)) {
			throw new Error('the sign-in plugin redirected to an Ever issuer with the connection off');
		}
	},

	/**
	 * entitlement_ladder: the mock platform's clock is moved so the documents it signs are dated in
	 * the past or the future of the installation's clock. At each step the installation refreshes
	 * on demand (a new document each time) and the ladder must follow; Gauzy's own routes must answer
	 * as they did before the first step.
	 */
	async entitlementLadder(ctx) {
		const session = await connected(ctx);
		const org = session.organizationId;
		const before = await coreRoutes(session);
		ctx.log(`adapter: Gauzy's routes before: ${JSON.stringify(before)}`);
		const realNow = () => Math.floor(Date.now() / 1000);
		const day = 86_400;
		const steps = [
			{
				name: 'issued 600 s in the future (refused, the stored one kept)',
				at: () => realNow() + 600,
				ladder: 'valid',
				newSeq: false
			},
			{ name: 'expired a day ago (grace)', at: () => realNow() - 8 * day, ladder: 'grace', newSeq: true },
			{ name: 'expired 31 days ago (paused)', at: () => realNow() - 38 * day, ladder: 'paused', newSeq: true },
			{ name: 'issued 200 s ahead (accepted)', at: () => realNow() + 200, ladder: 'valid', newSeq: true }
		];
		let seq =
			(await api(session, 'GET', `/api/ever-connect/entitlement?organizationId=${org}`)).body?.instance?.seq ??
			null;
		if (seq === null) throw new Error('no entitlement document was stored at connect');
		for (const step of steps) {
			await mock(session, 'clock', { set: step.at() });
			await mock(session, 'entitlement/reissue', { instance_id: session.instanceId });
			const refreshed = await api(session, 'POST', `/api/ever-connect/entitlement/refresh?organizationId=${org}`);
			await mock(session, 'clock', { set: realNow() });
			if (refreshed.status !== 200)
				throw new Error(
					`${step.name}: the refresh answered ${refreshed.status} ${JSON.stringify(refreshed.body)}`
				);
			const instance = refreshed.body?.instance;
			const features = Object.values(instance?.features ?? {});
			ctx.log(
				`adapter: ${step.name}: ladder ${instance?.ladder}, seq ${instance?.seq}, features on ${features.filter(Boolean).length}`
			);
			if (instance?.ladder !== step.ladder)
				throw new Error(`${step.name}: the ladder is ${instance?.ladder}, expected ${step.ladder}`);
			if (step.newSeq === (instance?.seq === seq)) {
				throw new Error(
					`${step.name}: the stored document is seq ${instance?.seq} (was ${seq}); ${step.newSeq ? 'a new one' : 'the old one'} was expected`
				);
			}
			if (step.ladder === 'paused' && features.some(Boolean))
				throw new Error(`${step.name}: a feature is still on while paused`);
			seq = instance.seq;
			const after = await coreRoutes(session);
			if (JSON.stringify(after) !== JSON.stringify(before)) {
				throw new Error(
					`${step.name}: Gauzy's own routes changed: ${JSON.stringify(before)} then ${JSON.stringify(after)}`
				);
			}
		}
		ctx.log("adapter: the ladder followed every document and Gauzy's own routes answered the same at every step");
	},

	/** Ids for the browser's routes (the user, the organization, the employee): never a token. */
	async createFixtures(ctx) {
		const { user, token } = await apiLogin(ctx);
		const fixtures = {
			userId: user.id ?? UNKNOWN_ID,
			organizationId: user.lastOrganizationId ?? organizationOf(token) ?? UNKNOWN_ID,
			employeeId: user.employee?.id ?? UNKNOWN_ID
		};
		ctx.log(`adapter: fixtures for the browser: ${Object.keys(fixtures).join(', ')}`);
		return fixtures;
	},

	/** Off modes only: each statistics route, with its own method, must answer 404. */
	async openSettings({ baseUrl, mode, fetch, log }) {
		if (!OFF_MODES.has(mode)) return;
		const answers = [];
		for (const [method, path] of STATS_ROUTES) {
			const response = await fetch(`${baseUrl}${path}`, {
				method,
				redirect: 'manual',
				headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
				body:
					method === 'GET'
						? undefined
						: JSON.stringify(method === 'PUT' ? { enabled: true } : { confirm: true })
			});
			answers.push({ route: `${method} ${path}`, status: response.status });
		}
		log(`adapter: ${answers.map((a) => `${a.route} ${a.status}`).join('; ')}`);
		const answered = answers.filter((a) => a.status !== 404);
		if (answered.length > 0) {
			throw new Error(
				`with the statistics off every statistics route must answer 404: ${answered.map((a) => `${a.route} ${a.status}`).join('; ')}`
			);
		}
	},

	/** loaded_off: the instance operator switches the statistics off in Settings, as a person would. */
	async prepareLoadedOff(ctx) {
		const { headers } = await apiLogin(ctx);
		const response = await ctx.fetch(`${ctx.baseUrl}/api/ever-stats/enabled`, {
			method: 'PUT',
			headers: { ...headers, 'content-type': 'application/json' },
			body: JSON.stringify({ enabled: false })
		});
		if (response.status !== 200) throw new Error(`switching the statistics off answered ${response.status}`);
		const status = await (await ctx.fetch(`${ctx.baseUrl}/api/ever-stats/status`, { headers })).json();
		if (status?.enabled !== false)
			throw new Error('the statistics still read as on after the operator switched them off');
		ctx.log('adapter: the operator switched the statistics off in Settings');
	},

	/**
	 * Browser leg: the signed-out pages first (SIGNED_OUT_ROUTES), then the real sign-in page. The web
	 * app routes in the URL fragment (`/#/auth/login`): the config says `"ui_routing": "hash"`, so
	 * `ctx.baseUrl` is the web app's address with `/#` and `ctx.baseUrl + route` opens a route. The
	 * sign-in page is `ui_sign_in_route`, and the harness faults every route that ends on it, so a
	 * walk that lost its session never passes there.
	 */
	async uiLogin(page, ctx) {
		const origin = new URL(ctx.baseUrl).origin;
		for (const [index, route] of SIGNED_OUT_ROUTES.entries()) {
			await page.goto(`${origin}/?signed-out=${index}#${route}`, { waitUntil: 'load' });
			await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
			await page.waitForTimeout(500);
		}
		ctx.log(`adapter: opened ${SIGNED_OUT_ROUTES.length} signed-out pages`);
		await page.goto(`${ctx.baseUrl}/auth/login`);
		try {
			await page.fill('#input-email', SEED_EMAIL, { timeout: 120_000 });
			await page.fill('#input-password', seedPassword(ctx));
			await Promise.all([
				page.waitForURL((url) => /^#\/(pages|onboarding)(\/|$)/.test(new URL(url).hash), { timeout: 120_000 }),
				page.click('form button[type=submit]')
			]);
		} catch (error) {
			// Evidence of what the browser showed instead (seed data only): a screenshot and the
			// page's route and visible text.
			await page.screenshot({ path: '/out/sign-in-failed.png', fullPage: true }).catch(() => {});
			const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
			ctx.log(
				`adapter: the sign-in did not complete at ${routeOf(page.url())}; the page reads: ${text.split(/\s/).filter(Boolean).join(' ').slice(0, 300)}`
			);
			throw error;
		}
		ctx.log(`adapter: signed in, landed on ${routeOf(page.url())}`);
	},

	/** Route parameters: the seeded ids where the seed has one, an unknown id elsewhere. */
	async routeParams(ctx) {
		const f = ctx.fixtures ?? {};
		return {
			id: UNKNOWN_ID,
			employeeId: f.employeeId ?? UNKNOWN_ID,
			appointmentId: UNKNOWN_ID,
			eventId: UNKNOWN_ID,
			itemId: UNKNOWN_ID,
			itemVariantId: UNKNOWN_ID,
			pipelineId: UNKNOWN_ID,
			dealId: UNKNOWN_ID,
			integrationTenantId: UNKNOWN_ID,
			organizationId: f.organizationId ?? UNKNOWN_ID,
			'/pages/users/edit/:id': { id: f.userId ?? UNKNOWN_ID },
			'/pages/users/edit/:id/location': { id: f.userId ?? UNKNOWN_ID },
			'/pages/users/edit/:id/main': { id: f.userId ?? UNKNOWN_ID },
			'/pages/users/edit/:id/organizations': { id: f.userId ?? UNKNOWN_ID },
			'/pages/users/edit/:id/settings': { id: f.userId ?? UNKNOWN_ID },
			'/pages/organizations/edit/:id': { id: f.organizationId ?? UNKNOWN_ID },
			'/pages/organizations/edit/:id/main': { id: f.organizationId ?? UNKNOWN_ID },
			'/pages/organizations/edit/:id/location': { id: f.organizationId ?? UNKNOWN_ID },
			'/pages/organizations/edit/:id/settings': { id: f.organizationId ?? UNKNOWN_ID },
			'/pages/employees/edit/:id': { id: f.employeeId ?? UNKNOWN_ID },
			'/pages/employees/view/:id': { id: f.employeeId ?? UNKNOWN_ID }
		};
	}
};
