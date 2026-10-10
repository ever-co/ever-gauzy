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
// - browser leg: sign in through the real sign-in page, and keep checking that the session holds.

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

/**
 * Whether the web app holds a session: its persisted store (localStorage `_gauzyStore`) has a token.
 * Runs in the page.
 */
const HAS_SESSION = () => {
	try {
		return Boolean(JSON.parse(window.localStorage.getItem('_gauzyStore') || '{}')?.persist?.token);
	} catch {
		return false;
	}
};

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
const OFF_MODES = new Set(['off', 'off_env_file']);

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
		positive_managed: RUN_SEED
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
				body: method === 'GET' ? undefined : JSON.stringify(method === 'PUT' ? { enabled: true } : { confirm: true })
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
		if (status?.enabled !== false) throw new Error('the statistics still read as on after the operator switched them off');
		ctx.log('adapter: the operator switched the statistics off in Settings');
	},

	/**
	 * Browser leg: the signed-out pages first (SIGNED_OUT_ROUTES), then the real sign-in page. The web app routes in the URL fragment (`/#/auth/login`),
	 * so the config's web_url ends in `/#` and every route is opened as `/#/<route>`.
	 *
	 * The session is checked during the whole walk: the web app keeps its token in its persisted
	 * store (localStorage `_gauzyStore`, `persist.token`), and a walk that lost it (a sign-out, a token refused) closes the page, so every
	 * route after that faults instead of passing on the sign-in page.
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
			ctx.log(`adapter: the sign-in did not complete at ${routeOf(page.url())}; the page reads: ${text.split(/\s/).filter(Boolean).join(' ').slice(0, 300)}`);
			throw error;
		}
		const signedIn = await page
			.waitForFunction(HAS_SESSION, undefined, { timeout: 30_000 })
			.then(() => true)
			.catch(() => false);
		if (!signedIn) throw new Error('the sign-in page left no session (no token in the web app store)');
		ctx.log(`adapter: signed in, landed on ${routeOf(page.url())}`);

		const watch = setInterval(async () => {
			if (page.isClosed()) return clearInterval(watch);
			let held = true;
			try {
				held = await page.evaluate(HAS_SESSION);
			} catch {
				return; // a navigation in flight; the next tick reads again
			}
			if (!held) {
				clearInterval(watch);
				ctx.log(`adapter: the session did not hold (no token at ${routeOf(page.url())}): closing the page, so the rest of the walk faults`);
				await page.close().catch(() => {});
			}
		}, 2000);
		watch.unref?.();
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
