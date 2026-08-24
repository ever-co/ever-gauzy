import http from 'node:http';
import https from 'node:https';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const PROFILE_PATHNAME = '/api/timesheet/statistics/profile-activity';
const LIVENESS_PATHNAME = '/api/health/live';
const REQUEST_COUNT = 32;
const REQUEST_DEADLINE_MILLISECONDS = 5000;
const MINIMUM_AGENT_SOCKETS = 64;

const THRESHOLDS = Object.freeze({
	profileP95Milliseconds: 750,
	livenessP95Milliseconds: 250,
	livenessMaxMilliseconds: 500
});

const HTTP_ONLY_CAVEAT =
	'HTTP latency only; event-loop, CPU, memory, and pool health are not observed by this verifier.';

class VerifierFailure extends Error {
	constructor(code, metrics) {
		super(code);
		this.name = 'VerifierFailure';
		this.code = code;
		this.metrics = metrics;
	}
}

function fail(code, metrics) {
	throw new VerifierFailure(code, metrics);
}

function requiredString(value, code) {
	if (typeof value !== 'string' || value.length === 0) fail(code);

	return value;
}

function rejectUrlWhitespace(value, code) {
	if (value !== value.trim() || /[\u0000-\u0020\u007f]/u.test(value)) fail(code);
}

function decodePathForSafety(pathname) {
	let decoded = pathname.replaceAll('\\', '/');

	for (let index = 0; index < 2; index++) {
		try {
			const next = decodeURIComponent(decoded);
			if (next === decoded) break;
			decoded = next;
		} catch {
			fail('QUERY_ENCODING');
		}
	}

	return decoded;
}

function isTraversalPath(queryPath) {
	const pathname = queryPath.split('?', 1)[0];
	const decoded = decodePathForSafety(pathname);

	return decoded.split('/').some((segment) => segment === '.' || segment === '..');
}

function isLoopbackHostname(hostname) {
	const unwrapped = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
	if (unwrapped === 'localhost' || unwrapped === '::1') return true;

	const octets = unwrapped.split('.');
	return (
		octets.length === 4 &&
		octets.every((octet) => /^\d{1,3}$/u.test(octet) && Number(octet) <= 255) &&
		Number(octets[0]) === 127
	);
}

function parseUrl(value, code, base) {
	try {
		return new URL(value, base);
	} catch {
		fail(code);
	}
}

function validateBaseUrl(base, allowRemote) {
	if (base.protocol !== 'http:' && base.protocol !== 'https:') fail('BASE_PROTOCOL');
	if (base.username || base.password) fail('BASE_CREDENTIALS');
	if (base.hash) fail('BASE_FRAGMENT');
	if (base.search) fail('BASE_QUERY');
	if (!allowRemote && !isLoopbackHostname(base.hostname)) fail('REMOTE_HOST_REFUSED');
}

function validateRelativeQueryPath(rawQueryPath, base) {
	if (/^[\\/]{2}/u.test(rawQueryPath)) fail('QUERY_PROTOCOL_RELATIVE');
	if (/^[a-z][a-z\d+.-]*:/iu.test(rawQueryPath)) {
		const absolute = parseUrl(rawQueryPath, 'QUERY_ABSOLUTE');
		if (absolute.origin !== base.origin) fail('QUERY_CROSS_ORIGIN');
		fail('QUERY_ABSOLUTE');
	}
	if (rawQueryPath.includes('#')) fail('QUERY_FRAGMENT');
	if (isTraversalPath(rawQueryPath)) fail('QUERY_TRAVERSAL');
}

function validateProfileUrl(profileUrl, base) {
	if (profileUrl.origin !== base.origin) fail('QUERY_CROSS_ORIGIN');
	if (profileUrl.username || profileUrl.password) fail('QUERY_CREDENTIALS');
	if (profileUrl.hash) fail('QUERY_FRAGMENT');
	if (profileUrl.pathname !== PROFILE_PATHNAME) fail('QUERY_PATH');
}

function transportForProtocol(protocol) {
	if (protocol === 'https:') return https;
	if (protocol === 'http:') return http;

	return null;
}

export function nearestRankPercentile(samples, percentile) {
	if (!Array.isArray(samples) || samples.length === 0 || percentile <= 0 || percentile > 1) {
		fail('PERCENTILE_INPUT');
	}

	const sorted = [...samples].sort((left, right) => left - right);
	return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function createAlternatingRequestPlan(count = REQUEST_COUNT) {
	return Array.from({ length: count * 2 }, (_, index) => (index % 2 === 0 ? 'profile' : 'liveness'));
}

export function resolveVerifierTargets({ baseUrl, queryPath, allowRemote }) {
	const rawBaseUrl = requiredString(baseUrl, 'BASE_URL_REQUIRED');
	const rawQueryPath = requiredString(queryPath, 'QUERY_PATH_REQUIRED');
	rejectUrlWhitespace(rawBaseUrl, 'BASE_WHITESPACE');
	rejectUrlWhitespace(rawQueryPath, 'QUERY_WHITESPACE');

	const base = parseUrl(rawBaseUrl, 'BASE_URL_INVALID');
	validateBaseUrl(base, allowRemote);
	validateRelativeQueryPath(rawQueryPath, base);
	const profileUrl = parseUrl(rawQueryPath, 'QUERY_URL_INVALID', base);
	validateProfileUrl(profileUrl, base);

	return {
		profileUrl,
		livenessUrl: new URL(LIVENESS_PATHNAME, base.origin)
	};
}

export function createVerifierAgent(protocol) {
	const transport = transportForProtocol(protocol);
	if (!transport) fail('BASE_PROTOCOL');

	return new transport.Agent({
		keepAlive: true,
		maxSockets: MINIMUM_AGENT_SOCKETS,
		maxTotalSockets: MINIMUM_AGENT_SOCKETS,
		maxFreeSockets: MINIMUM_AGENT_SOCKETS
	});
}

export function requestAndDrain(url, agent, headers, deadlineMilliseconds = REQUEST_DEADLINE_MILLISECONDS) {
	const transport = transportForProtocol(url.protocol);
	if (!transport) return Promise.reject(new VerifierFailure('BASE_PROTOCOL'));

	return new Promise((resolveRequest, rejectRequest) => {
		const startedAt = performance.now();
		let settled = false;
		let request;

		const settle = (callback, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(deadline);
			callback(value);
		};

		const deadline = setTimeout(() => {
			if (settled) return;
			request?.destroy();
			settle(rejectRequest, new VerifierFailure('REQUEST_TIMEOUT'));
		}, deadlineMilliseconds);
		deadline.unref?.();

		try {
			request = transport.request(url, { method: 'GET', agent, headers }, (response) => {
				response.once('aborted', () => settle(rejectRequest, new VerifierFailure('REQUEST_FAILED')));
				response.once('error', () => settle(rejectRequest, new VerifierFailure('REQUEST_FAILED')));
				response.once('end', () => {
					const statusCode = response.statusCode ?? 0;
					if (statusCode < 200 || statusCode >= 300) {
						settle(rejectRequest, new VerifierFailure('HTTP_STATUS'));
						return;
					}

					settle(resolveRequest, performance.now() - startedAt);
				});
				response.resume();
			});
			request.once('error', () => settle(rejectRequest, new VerifierFailure('REQUEST_FAILED')));
			request.end();
		} catch {
			request?.destroy();
			settle(rejectRequest, new VerifierFailure('REQUEST_FAILED'));
		}
	});
}

function rawLatencyMetrics(samples) {
	return {
		count: samples.length,
		minMilliseconds: Math.min(...samples),
		p95Milliseconds: nearestRankPercentile(samples, 0.95),
		maxMilliseconds: Math.max(...samples)
	};
}

function roundedLatencyMetrics(rawMetrics) {
	return {
		count: rawMetrics.count,
		minMilliseconds: Number(rawMetrics.minMilliseconds.toFixed(3)),
		p95Milliseconds: Number(rawMetrics.p95Milliseconds.toFixed(3)),
		maxMilliseconds: Number(rawMetrics.maxMilliseconds.toFixed(3))
	};
}

function emptyLatencyMetrics() {
	return {
		count: 0,
		minMilliseconds: null,
		p95Milliseconds: null,
		maxMilliseconds: null
	};
}

export function evaluateLatencyThresholds(profileSamples, livenessSamples) {
	const rawProfile = rawLatencyMetrics(profileSamples);
	const rawLiveness = rawLatencyMetrics(livenessSamples);
	const metrics = {
		ok: true,
		profile: roundedLatencyMetrics(rawProfile),
		liveness: roundedLatencyMetrics(rawLiveness),
		thresholdsMilliseconds: THRESHOLDS,
		caveat: HTTP_ONLY_CAVEAT
	};

	if (rawProfile.p95Milliseconds > THRESHOLDS.profileP95Milliseconds) {
		fail('PROFILE_P95_THRESHOLD', metrics);
	}
	if (rawLiveness.p95Milliseconds > THRESHOLDS.livenessP95Milliseconds) {
		fail('LIVENESS_P95_THRESHOLD', metrics);
	}
	if (rawLiveness.maxMilliseconds > THRESHOLDS.livenessMaxMilliseconds) {
		fail('LIVENESS_MAX_THRESHOLD', metrics);
	}

	return metrics;
}

function failureMetrics(errorCode, measuredMetrics) {
	return {
		ok: false,
		errorCode,
		profile: measuredMetrics?.profile ?? emptyLatencyMetrics(),
		liveness: measuredMetrics?.liveness ?? emptyLatencyMetrics(),
		thresholdsMilliseconds: THRESHOLDS,
		caveat: HTTP_ONLY_CAVEAT
	};
}

export async function verifyProfileActivityConcurrency({
	baseUrl,
	bearerToken,
	tenantId,
	queryPath,
	allowRemote = false
}) {
	const token = requiredString(bearerToken, 'BEARER_TOKEN_REQUIRED');
	const tenant = requiredString(tenantId, 'TENANT_ID_REQUIRED');
	const { profileUrl, livenessUrl } = resolveVerifierTargets({ baseUrl, queryPath, allowRemote });
	const agent = createVerifierAgent(profileUrl.protocol);
	const profileSamples = [];
	const livenessSamples = [];

	try {
		const requests = createAlternatingRequestPlan().map((kind) => {
			if (kind === 'profile') {
				return requestAndDrain(
					profileUrl,
					agent,
					{ authorization: `Bearer ${token}`, 'tenant-id': tenant },
					REQUEST_DEADLINE_MILLISECONDS
				).then((latency) => {
					profileSamples.push(latency);
				});
			}

			return requestAndDrain(livenessUrl, agent, {}, REQUEST_DEADLINE_MILLISECONDS).then((latency) => {
				livenessSamples.push(latency);
			});
		});

		const settled = await Promise.allSettled(requests);
		const rejected = settled.find((result) => result.status === 'rejected');
		if (rejected) {
			if (rejected.reason instanceof VerifierFailure) throw rejected.reason;
			fail('REQUEST_FAILED');
		}

		if (profileSamples.length !== REQUEST_COUNT || livenessSamples.length !== REQUEST_COUNT) {
			fail('REQUEST_COUNT');
		}

		return evaluateLatencyThresholds(profileSamples, livenessSamples);
	} finally {
		agent.destroy();
	}
}

export async function runFromEnvironment(environment, writeLine = (line) => process.stdout.write(line)) {
	try {
		const metrics = await verifyProfileActivityConcurrency({
			baseUrl: environment.PROFILE_ACTIVITY_BASE_URL,
			bearerToken: environment.PROFILE_ACTIVITY_BEARER_TOKEN,
			tenantId: environment.PROFILE_ACTIVITY_TENANT_ID,
			queryPath: environment.PROFILE_ACTIVITY_QUERY_PATH,
			allowRemote: environment.PROFILE_ACTIVITY_ALLOW_REMOTE === '1'
		});
		writeLine(`${JSON.stringify(metrics)}\n`);
		return 0;
	} catch (error) {
		const errorCode = error instanceof VerifierFailure ? error.code : 'INTERNAL_FAILURE';
		const metrics = error instanceof VerifierFailure ? error.metrics : undefined;
		writeLine(`${JSON.stringify(failureMetrics(errorCode, metrics))}\n`);
		return 1;
	}
}

if (pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	process.exitCode = await runFromEnvironment(process.env);
}
