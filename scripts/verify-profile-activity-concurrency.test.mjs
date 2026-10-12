import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, test } from 'node:test';

import {
	createAlternatingRequestPlan,
	createVerifierAgent,
	evaluateLatencyThresholds,
	nearestRankPercentile,
	requestAndDrain,
	resolveVerifierTargets,
	runFromEnvironment,
	verifyProfileActivityConcurrency
} from './verify-profile-activity-concurrency.mjs';

const PROFILE_PATH = '/api/timesheet/statistics/profile-activity';
const TOKEN = 'fixed-profile-verifier-token';
const TENANT_ID = '94b533dd-3573-4240-8d33-5aa974195587';
const EMPLOYEE_ID = '61279aba-8b95-4ed0-864a-f45e79abb617';
const QUERY_PATH =
	`${PROFILE_PATH}?organizationId=80f7eac1-3bbc-48ad-8f39-37bdd574f5eb` +
	`&employeeId=${EMPLOYEE_ID}&organizationTeamId=d0884ec0-e9d7-443f-afac-638ce0b51685` +
	'&startDate=2026-08-01&endDate=2026-09-01&timeZone=Europe%2FMadrid&includeDaily=true';

const openServers = new Set();

async function listen(handler) {
	const server = http.createServer(handler);
	openServers.add(server);

	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			server.off('error', reject);
			resolve();
		});
	});

	const address = server.address();
	assert.notEqual(address, null);
	assert.equal(typeof address, 'object');

	return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
	if (!openServers.delete(server)) return;

	await new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

function failureCode(code) {
	return (error) => error instanceof Error && error.code === code;
}

afterEach(async () => {
	await Promise.all([...openServers].map((server) => closeServer(server)));
});

test('uses the approved nearest-rank percentile position', () => {
	assert.equal(
		nearestRankPercentile(
			Array.from({ length: 32 }, (_, index) => 32 - index),
			0.95
		),
		31
	);
	assert.equal(
		nearestRankPercentile(
			Array.from({ length: 21 }, (_, index) => index + 1),
			0.95
		),
		20
	);
	assert.throws(() => nearestRankPercentile([], 0.95), failureCode('PERCENTILE_INPUT'));
});

test('builds an exact alternating 32 plus 32 launch plan', () => {
	const plan = createAlternatingRequestPlan(32);
	const agent = createVerifierAgent('http:');

	try {
		assert.equal(plan.length, 64);
		assert.deepEqual(
			plan,
			Array.from({ length: 64 }, (_, index) => (index % 2 === 0 ? 'profile' : 'liveness'))
		);
		assert.equal(agent.keepAlive, true);
		assert.ok(agent.maxSockets >= 64);
		assert.ok(agent.maxTotalSockets >= 64);
		assert.ok(agent.maxFreeSockets >= 64);
	} finally {
		agent.destroy();
	}
});

test('accepts only approved loopback and explicit remote targets', () => {
	for (const baseUrl of ['http://localhost:3000', 'http://127.0.0.2:3000', 'http://[::1]:3000']) {
		const targets = resolveVerifierTargets({ baseUrl, queryPath: QUERY_PATH, allowRemote: false });
		assert.equal(targets.profileUrl.pathname, PROFILE_PATH);
	}

	assert.throws(
		() =>
			resolveVerifierTargets({
				baseUrl: 'https://192.0.2.10',
				queryPath: QUERY_PATH,
				allowRemote: false
			}),
		failureCode('REMOTE_HOST_REFUSED')
	);
	assert.doesNotThrow(() =>
		resolveVerifierTargets({
			baseUrl: 'https://192.0.2.10',
			queryPath: QUERY_PATH,
			allowRemote: true
		})
	);
});

test('rejects unsafe base URLs and profile paths before making requests', () => {
	const baseUrl = 'http://127.0.0.1:3000';
	const invalidCases = [
		{ baseUrl: 'ftp://127.0.0.1:3000', queryPath: QUERY_PATH, code: 'BASE_PROTOCOL' },
		{ baseUrl: 'http://user:pass@127.0.0.1:3000', queryPath: QUERY_PATH, code: 'BASE_CREDENTIALS' },
		{ baseUrl: 'http://127.0.0.1:3000/#unsafe', queryPath: QUERY_PATH, code: 'BASE_FRAGMENT' },
		{ baseUrl, queryPath: `//example.invalid${PROFILE_PATH}`, code: 'QUERY_PROTOCOL_RELATIVE' },
		{ baseUrl, queryPath: `${baseUrl}${QUERY_PATH}`, code: 'QUERY_ABSOLUTE' },
		{ baseUrl, queryPath: `https://example.invalid${QUERY_PATH}`, code: 'QUERY_CROSS_ORIGIN' },
		{ baseUrl, queryPath: '/api/timesheet/statistics/../profile-activity', code: 'QUERY_TRAVERSAL' },
		{ baseUrl, queryPath: '/api/timesheet/statistics/%2e%2e/profile-activity', code: 'QUERY_TRAVERSAL' },
		{ baseUrl, queryPath: `${QUERY_PATH}#unsafe`, code: 'QUERY_FRAGMENT' },
		{ baseUrl, queryPath: '/api/timesheet/statistics/other', code: 'QUERY_PATH' }
	];

	for (const invalidCase of invalidCases) {
		assert.throws(
			() => resolveVerifierTargets({ ...invalidCase, allowRemote: false }),
			failureCode(invalidCase.code)
		);
	}
});

test('rejects leading, trailing, and embedded ASCII whitespace before URL parsing', () => {
	const baseUrl = 'http://127.0.0.1:3000';
	const invalidCases = [
		{ baseUrl: ` ${baseUrl}`, queryPath: QUERY_PATH, code: 'BASE_WHITESPACE' },
		{ baseUrl: `${baseUrl}\t`, queryPath: QUERY_PATH, code: 'BASE_WHITESPACE' },
		{ baseUrl: 'http://127.0.0.1:\n3000', queryPath: QUERY_PATH, code: 'BASE_WHITESPACE' },
		{ baseUrl, queryPath: `\t//example.invalid${PROFILE_PATH}`, code: 'QUERY_WHITESPACE' },
		{ baseUrl, queryPath: `\nhttps://example.invalid${QUERY_PATH}`, code: 'QUERY_WHITESPACE' },
		{ baseUrl, queryPath: `${QUERY_PATH} `, code: 'QUERY_WHITESPACE' },
		{ baseUrl, queryPath: `${PROFILE_PATH}\u007f?organizationId=unsafe`, code: 'QUERY_WHITESPACE' }
	];

	for (const invalidCase of invalidCases) {
		assert.throws(
			() => resolveVerifierTargets({ ...invalidCase, allowRemote: false }),
			failureCode(invalidCase.code)
		);
	}
});

test('compares unrounded p95 and max latencies to every threshold', () => {
	assert.throws(
		() => evaluateLatencyThresholds(Array(32).fill(750.0004), Array(32).fill(1)),
		(error) => {
			assert.equal(error.code, 'PROFILE_P95_THRESHOLD');
			assert.equal(error.metrics.profile.p95Milliseconds, 750);
			return true;
		}
	);
	assert.throws(
		() => evaluateLatencyThresholds(Array(32).fill(1), Array(32).fill(250.0004)),
		(error) => {
			assert.equal(error.code, 'LIVENESS_P95_THRESHOLD');
			assert.equal(error.metrics.liveness.p95Milliseconds, 250);
			return true;
		}
	);
	assert.throws(
		() => evaluateLatencyThresholds(Array(32).fill(1), [...Array(31).fill(1), 500.0004]),
		(error) => {
			assert.equal(error.code, 'LIVENESS_MAX_THRESHOLD');
			assert.equal(error.metrics.liveness.p95Milliseconds, 1);
			assert.equal(error.metrics.liveness.maxMilliseconds, 500);
			return true;
		}
	);

	const diagnostic = evaluateLatencyThresholds(Array(32).fill(900), Array(32).fill(600), false);
	assert.equal(diagnostic.ok, true);
	assert.equal(diagnostic.profile.p95Milliseconds, 900);
	assert.equal(diagnostic.liveness.maxMilliseconds, 600);
});

test('maps hard request deadlines and non-success statuses to stable codes', async () => {
	const { server, baseUrl } = await listen((request, response) => {
		if (request.url === '/slow') return;
		response.writeHead(503, { 'content-type': 'text/plain' });
		response.end('private response body');
	});
	const agent = createVerifierAgent('http:');

	try {
		await assert.rejects(requestAndDrain(new URL('/slow', baseUrl), agent, {}, 30), failureCode('REQUEST_TIMEOUT'));
		await assert.rejects(
			requestAndDrain(new URL('/unavailable', baseUrl), agent, {}, 1000),
			failureCode('HTTP_STATUS')
		);
	} finally {
		agent.destroy();
		await closeServer(server);
	}
});

test('times through delayed body completion and aborts a post-header timeout', async () => {
	let postHeaderClosed;
	const postHeaderCloseObserved = new Promise((resolve) => {
		postHeaderClosed = resolve;
	});
	const { server, baseUrl } = await listen((request, response) => {
		if (request.url === '/delayed-body') {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.write('{"ok":');
			setTimeout(() => response.end('true}'), 45);
			return;
		}

		response.once('close', postHeaderClosed);
		response.writeHead(200, { 'content-type': 'application/json' });
		response.flushHeaders();
	});
	const agent = createVerifierAgent('http:');

	try {
		const latency = await requestAndDrain(new URL('/delayed-body', baseUrl), agent, {}, 1000);
		assert.ok(latency >= 35, `expected body-inclusive latency, received ${latency}ms`);
		await assert.rejects(
			requestAndDrain(new URL('/post-header-timeout', baseUrl), agent, {}, 30),
			failureCode('REQUEST_TIMEOUT')
		);
		await postHeaderCloseObserved;
	} finally {
		agent.destroy();
		await closeServer(server);
	}
});

test('sends exactly 32 protected and 32 public calls with no protected headers on public calls', async () => {
	const received = [];
	const { server, baseUrl } = await listen((request, response) => {
		received.push({ url: request.url, headers: request.headers });
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end('{"ok":true}');
	});

	const metrics = await verifyProfileActivityConcurrency({
		baseUrl,
		bearerToken: TOKEN,
		tenantId: TENANT_ID,
		queryPath: QUERY_PATH,
		allowRemote: false
	});

	const profileCalls = received.filter(({ url }) => new URL(url, baseUrl).pathname === PROFILE_PATH);
	const livenessCalls = received.filter(({ url }) => new URL(url, baseUrl).pathname === '/api/health/live');

	assert.equal(metrics.ok, true);
	assert.equal(metrics.profile.count, 32);
	assert.equal(metrics.liveness.count, 32);
	assert.equal(profileCalls.length, 32);
	assert.equal(livenessCalls.length, 32);
	assert.ok(profileCalls.every(({ headers }) => headers.authorization === `Bearer ${TOKEN}`));
	assert.ok(profileCalls.every(({ headers }) => headers['tenant-id'] === TENANT_ID));
	assert.ok(livenessCalls.every(({ headers }) => headers.authorization === undefined));
	assert.ok(livenessCalls.every(({ headers }) => headers['tenant-id'] === undefined));

	await closeServer(server);
});

test('emits one safe JSON line and never leaks request or response details on failure', async () => {
	const { server, baseUrl } = await listen((_request, response) => {
		response.writeHead(503, { 'content-type': 'application/json' });
		response.end(`{"token":"${TOKEN}","tenant":"${TENANT_ID}"}`);
	});
	let output = '';

	const exitCode = await runFromEnvironment(
		{
			PROFILE_ACTIVITY_BASE_URL: baseUrl,
			PROFILE_ACTIVITY_BEARER_TOKEN: TOKEN,
			PROFILE_ACTIVITY_TENANT_ID: TENANT_ID,
			PROFILE_ACTIVITY_QUERY_PATH: QUERY_PATH
		},
		(line) => {
			output += line;
		}
	);

	assert.equal(exitCode, 1);
	assert.equal(output.trim().split(/\r?\n/u).length, 1);
	const payload = JSON.parse(output);
	assert.equal(payload.ok, false);
	assert.equal(payload.errorCode, 'HTTP_STATUS');
	for (const forbidden of [TOKEN, TENANT_ID, EMPLOYEE_ID, PROFILE_PATH, baseUrl]) {
		assert.equal(output.includes(forbidden), false);
	}

	await closeServer(server);
});

test('emits one safe success JSON line without any request input or full URL', async () => {
	const { server, baseUrl } = await listen((_request, response) => {
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end('{"ok":true}');
	});
	let output = '';

	const exitCode = await runFromEnvironment(
		{
			PROFILE_ACTIVITY_BASE_URL: baseUrl,
			PROFILE_ACTIVITY_BEARER_TOKEN: TOKEN,
			PROFILE_ACTIVITY_TENANT_ID: TENANT_ID,
			PROFILE_ACTIVITY_QUERY_PATH: QUERY_PATH
		},
		(line) => {
			output += line;
		}
	);

	assert.equal(exitCode, 0);
	assert.equal(output.trim().split(/\r?\n/u).length, 1);
	const payload = JSON.parse(output);
	assert.equal(payload.ok, true);
	assert.equal(payload.profile.count, 32);
	assert.equal(payload.liveness.count, 32);
	const forbiddenValues = {
		token: TOKEN,
		tenant: TENANT_ID,
		employee: EMPLOYEE_ID,
		path: PROFILE_PATH,
		queryPath: QUERY_PATH,
		baseUrl,
		fullUrl: `${baseUrl}${QUERY_PATH}`
	};
	for (const [label, forbidden] of Object.entries(forbiddenValues)) {
		assert.equal(output.includes(forbidden), false, `${label} leaked in success JSON`);
	}

	await closeServer(server);
});
