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

/**
 * The seeded Super Admin of the audit's throw-away database (compose.egress-audit.yml). Not a
 * secret: the database lives only inside the sealed audit network for one run.
 */
const SEED_EMAIL = 'admin@example.com';
const SEED_PASSWORD = 'egress-audit-seed-only';

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
async function apiLogin({ baseUrl, fetch }) {
	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ email: SEED_EMAIL, password: SEED_PASSWORD })
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
		off: LOADED_BY_MISTAKE_WOULD_SHOW,
		off_env_file: LOADED_BY_MISTAKE_WOULD_SHOW,
		loaded_off: LOADED_OFF
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
	 * Browser leg: the real sign-in page. The web app routes in the URL fragment (`/#/auth/login`),
	 * so the config's web_url ends in `/#` and every route is opened as `/#/<route>`.
	 *
	 * The session is checked during the whole walk: the web app keeps its token in localStorage
	 * under `token`, and a walk that lost it (a sign-out, a token refused) closes the page, so every
	 * route after that faults instead of passing on the sign-in page.
	 */
	async uiLogin(page, ctx) {
		await page.goto(`${ctx.baseUrl}/auth/login`);
		await page.fill('#input-email', SEED_EMAIL);
		await page.fill('#input-password', SEED_PASSWORD);
		await Promise.all([
			page.waitForURL((url) => /^#\/(pages|onboarding)(\/|$)/.test(new URL(url).hash), { timeout: 120_000 }),
			page.click('form button[type=submit]')
		]);
		const signedIn = await page.evaluate(() => Boolean(window.localStorage.getItem('token')));
		if (!signedIn) throw new Error('the sign-in page left no session (no token in localStorage)');
		ctx.log(`adapter: signed in, landed on ${new URL(page.url()).hash.replace(/\?.*$/, '')}`);

		const watch = setInterval(async () => {
			if (page.isClosed()) return clearInterval(watch);
			let held = true;
			try {
				held = await page.evaluate(() => Boolean(window.localStorage.getItem('token')));
			} catch {
				return; // a navigation in flight; the next tick reads again
			}
			if (!held) {
				clearInterval(watch);
				ctx.log(`adapter: the session did not hold (no token at ${new URL(page.url()).hash.replace(/\?.*$/, '')}): closing the page, so the rest of the walk faults`);
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
			'/pages/employees/edit/:id': { id: f.employeeId ?? UNKNOWN_ID },
			'/pages/employees/view/:id': { id: f.employeeId ?? UNKNOWN_ID }
		};
	}
};
