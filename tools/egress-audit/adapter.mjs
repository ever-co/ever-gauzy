// Ever Gauzy's adapter for the Ever Platform egress audit (see README.md).
//
// The audit's driver runs it inside the sealed audit network, so it reaches the API by its compose
// service name. In the off modes it does what anyone could do without an account: call every route
// of the anonymous usage statistics with its own method, and require 404 from each.

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
	EVER_STATS_API_URL: 'http://ever-audit-sink:8080',
	EVER_STATS_SERVES: 'gauzy,teams'
};

export default {
	env: {
		off: LOADED_BY_MISTAKE_WOULD_SHOW,
		off_env_file: LOADED_BY_MISTAKE_WOULD_SHOW
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
	}
};
