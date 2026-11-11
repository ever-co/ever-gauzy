#!/usr/bin/env node
/**
 * The real-time channel's live check (realtime-channel task T18), against a running API that loads the plugin
 * (`GAUZY_REALTIME_ENABLED=true`): a task update must reach a `collaborationEvents` subscriber, and the catch-up must
 * replay it.
 *
 * It needs a signed-in user's credential, which the operator provides — this script never signs in:
 *
 *   GAUZY_API_URL=https://api.example.com/api \
 *   GAUZY_TOKEN=<access token> GAUZY_TENANT_ID=<tenant> GAUZY_ORGANIZATION_ID=<organization> \
 *   GAUZY_TASK_ID=<a task the user may update> \
 *   node tools/scripts/realtime-live-probe.mjs
 *
 * Optional: `GAUZY_WS_URL` (default: the API URL's origin on ws(s) + `/graphql`), `GAUZY_LIVE_TARGET_MS` (default
 * 1000, the spec's target), `GAUZY_LIVE_WAIT_MS` (default 90000). Live events ride the outbox dispatcher, which runs a
 * pass right after each commit (realtime task T28) where the API consumes the dispatch queue; with
 * `GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT=false`, or before T28, they wait for the per-minute pass, so the latency is up to
 * about a minute (set `GAUZY_LIVE_TARGET_MS=90000` to check delivery itself).
 *
 * The update writes the task's own title, status and organization back unchanged (a `PUT /tasks/:id` carries the first
 * two; the organization lets the platform file the hint), which the platform reports as `task.updated`. The event is
 * told apart from earlier updates of the task by its id: the task's `task.updated` events already in the outbox are
 * read first, and only another one counts — no clock is compared. Exit code 0 when the event arrived live within the
 * target and the catch-up replayed that same event; 1 when either failed (the report says which, with the measured
 * latency); 2 for missing configuration.
 */
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const env = process.env;
const api = (env.GAUZY_API_URL ?? '').replace(/\/+$/, '');
const token = env.GAUZY_TOKEN ?? '';
const tenantId = env.GAUZY_TENANT_ID ?? '';
const organizationId = env.GAUZY_ORGANIZATION_ID ?? '';
const taskId = env.GAUZY_TASK_ID ?? '';
const targetMs = Number(env.GAUZY_LIVE_TARGET_MS ?? 1_000);
const waitMs = Number(env.GAUZY_LIVE_WAIT_MS ?? 90_000);
const positive = (value) => Number.isFinite(value) && value > 0;

/** The subscription endpoint of an API URL: its origin on ws(s), at `/graphql`. */
export function socketUrlOf(apiUrl) {
	const url = new URL(apiUrl);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = '/graphql';
	url.search = '';
	return url.toString();
}

const headers = () => ({
	'Content-Type': 'application/json',
	Authorization: `Bearer ${token}`,
	'tenant-id': tenantId,
	'organization-id': organizationId
});

async function http(method, path, body) {
	const response = await fetch(`${api}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
	const text = await response.text();
	if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}: ${text.slice(0, 200)}`);
	return text ? JSON.parse(text) : null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The task's `task.updated` events the catch-up answers from a position (every page, at most 20). */
async function updatesOfTask(from) {
	const found = [];
	let position = from;
	for (let page = 0; page < 20; page += 1) {
		const query = new URLSearchParams({ after: String(position.after), limit: '500' });
		if (position.afterId) query.set('afterId', position.afterId);
		const answer = await http('GET', `/realtime/events?${query}`);
		if (answer.resync) throw new Error('the catch-up answered resync');
		found.push(...answer.events.filter((event) => event.aggregate?.id === taskId && event.eventName === 'task.updated'));
		if (!answer.hasMore) break;
		position = { after: answer.cursor, afterId: answer.cursorId };
	}
	return found;
}

async function main() {
	const missing = ['GAUZY_API_URL', 'GAUZY_TOKEN', 'GAUZY_TENANT_ID', 'GAUZY_ORGANIZATION_ID', 'GAUZY_TASK_ID'].filter((name) => !env[name]);
	if (missing.length) {
		console.error(`Missing configuration: ${missing.join(', ')} (see the header of this script).`);
		return 2;
	}
	if (!positive(targetMs) || !positive(waitMs)) {
		console.error('GAUZY_LIVE_TARGET_MS and GAUZY_LIVE_WAIT_MS must be positive numbers of milliseconds.');
		return 2;
	}

	// The position to replay from, taken before anything happens.
	const start = await http('GET', '/realtime/events');
	console.log(`catch-up start position: ${start.cursor} (${start.cursorId ?? 'time only'})`);

	const client = createClient({
		url: env.GAUZY_WS_URL || socketUrlOf(api),
		webSocketImpl: WebSocket,
		connectionParams: { authorization: `Bearer ${token}`, 'tenant-id': tenantId, 'organization-id': organizationId },
		retryAttempts: 0
	});
	// The task's updates already in the outbox (dispatched or not): none of them is the one this check makes.
	const before = new Set();
	let writing = false;
	let liveMs = null;
	// Settled with the event and the moment it arrived, `null` (none within the wait) or the subscription's error —
	// handled from the start, so a refused socket can never surface as an unhandled rejection while the script is still
	// preparing the write.
	const live = new Promise((resolve, reject) => {
		const timer = setTimeout(() => resolve(null), waitMs);
		client.subscribe(
			{ query: 'subscription($names: [String!]!) { collaborationEvents(names: $names) { eventId eventName occurredAt aggregate { type id } } }', variables: { names: ['task.*'] } },
			{
				next: (message) => {
					const event = message?.data?.collaborationEvents;
					if (writing && event?.aggregate?.id === taskId && event.eventName === 'task.updated' && !before.has(event.eventId)) {
						clearTimeout(timer);
						// Timed here, on arrival: the write's own HTTP answer may come later and must not count.
						resolve({ event, at: Date.now() });
					}
				},
				error: (error) => {
					clearTimeout(timer);
					reject(error instanceof Error ? error : new Error(JSON.stringify(error)));
				},
				complete: () => undefined
			}
		);
	}).catch((error) => {
		console.error(`subscription failed: ${error.message}`);
		return null;
	});
	const from = { after: start.cursor, afterId: start.cursorId };
	let event = null;
	try {
		// Let the subscription start before the write.
		await sleep(1_500);
		for (const known of await updatesOfTask(from)) before.add(known.eventId);
		const task = await http('GET', `/tasks/${taskId}`);
		writing = true;
		const updatedAt = Date.now();
		await http('PUT', `/tasks/${taskId}`, { title: task.title, status: task.status, organizationId: task.organizationId ?? organizationId });
		console.log(`task ${taskId} updated at ${new Date(updatedAt).toISOString()}`);
		const received = await live;
		if (received) {
			event = received.event;
			liveMs = Math.max(0, received.at - updatedAt);
		}
	} finally {
		// Closed whatever happened above (a failed read or write included), so the socket ends cleanly.
		await client.dispose();
	}

	// The catch-up from the start position must answer the same event — the one received live, or, when none arrived,
	// an update of the task that was not there before the write.
	await sleep(2_000);
	const replayable = (await updatesOfTask(from)).filter((candidate) => !before.has(candidate.eventId));
	const replayed = (event ? replayable.find((candidate) => candidate.eventId === event.eventId) : replayable[0]) ?? null;

	const liveOk = liveMs !== null && liveMs <= targetMs;
	console.log(`live: ${liveMs === null ? `not received within ${waitMs} ms` : `${liveMs} ms`} (target ${targetMs} ms) — ${liveOk ? 'PASS' : 'FAIL'}`);
	if (!liveOk && liveMs !== null) console.log('(slow live delivery: is the API consuming the outbox queue, with GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT on?)');
	console.log(`catch-up replay: ${replayed ? `PASS (${replayed.eventId})` : 'FAIL'}`);
	return liveOk && replayed ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('realtime-live-probe.mjs')) {
	main().then(
		(code) => process.exit(code),
		(error) => {
			console.error(error.message);
			process.exit(1);
		}
	);
}
