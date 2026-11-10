#!/usr/bin/env node
/**
 * The real-time channel's live check (realtime-channel task T18), against a running API that loads the plugin
 * (`GAUZY_REALTIME_ENABLED=true`): a task update must reach a `collaborationEvents` subscriber, and the catch-up must
 * replay it.
 *
 * It needs a signed-in user's credential, which the operator provides — this script never signs in:
 *
 *   GAUZY_API_URL=https://apidemo.gauzy.co/api \
 *   GAUZY_TOKEN=<access token> GAUZY_TENANT_ID=<tenant> GAUZY_ORGANIZATION_ID=<organization> \
 *   GAUZY_TASK_ID=<a task the user may update> \
 *   node tools/scripts/realtime-live-check.mjs
 *
 * Optional: `GAUZY_WS_URL` (default: the API URL's origin on ws(s) + `/graphql`), `GAUZY_LIVE_TARGET_MS` (default
 * 1000), `GAUZY_LIVE_WAIT_MS` (default 90000: live events ride the outbox dispatcher, which runs every minute).
 *
 * The update writes the task's own title and status back unchanged (a `PUT /tasks/:id` carries both), which the platform
 * reports as `task.updated`. Exit code 0 when the event arrived live within the target and the catch-up replayed it;
 * 1 when either failed (the report says which, with the measured latency); 2 for missing configuration.
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

async function main() {
	const missing = ['GAUZY_API_URL', 'GAUZY_TOKEN', 'GAUZY_TENANT_ID', 'GAUZY_ORGANIZATION_ID', 'GAUZY_TASK_ID'].filter((name) => !env[name]);
	if (missing.length) {
		console.error(`Missing configuration: ${missing.join(', ')} (see the header of this script).`);
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
	let updatedAt = 0;
	let liveMs = null;
	const live = new Promise((resolve, reject) => {
		const timer = setTimeout(() => resolve(null), waitMs);
		client.subscribe(
			{ query: 'subscription($names: [String!]!) { collaborationEvents(names: $names) { eventId eventName occurredAt aggregate { type id } } }', variables: { names: ['task.*'] } },
			{
				next: (message) => {
					const event = message?.data?.collaborationEvents;
					if (event?.aggregate?.id === taskId && event.eventName === 'task.updated' && updatedAt) {
						clearTimeout(timer);
						resolve(event);
					}
				},
				error: (error) => {
					clearTimeout(timer);
					reject(error instanceof Error ? error : new Error(JSON.stringify(error)));
				},
				complete: () => undefined
			}
		);
	});
	// Let the subscription start before the write.
	await sleep(1_500);

	const task = await http('GET', `/tasks/${taskId}`);
	updatedAt = Date.now();
	await http('PUT', `/tasks/${taskId}`, { title: task.title, status: task.status });
	console.log(`task ${taskId} updated at ${new Date(updatedAt).toISOString()}`);

	const event = await live.catch((error) => {
		console.error(`subscription failed: ${error.message}`);
		return null;
	});
	if (event) liveMs = Date.now() - updatedAt;
	await client.dispose();

	// The catch-up from the start position must answer the same event (it may take a page or two).
	let replayed = null;
	let position = { after: start.cursor, afterId: start.cursorId };
	for (let page = 0; page < 20 && !replayed; page += 1) {
		const query = new URLSearchParams({ after: String(position.after), limit: '500' });
		if (position.afterId) query.set('afterId', position.afterId);
		const answer = await http('GET', `/realtime/events?${query}`);
		replayed = answer.events.find((candidate) => candidate.aggregate?.id === taskId && candidate.eventName === 'task.updated' && Date.parse(candidate.occurredAt) >= updatedAt - 5_000) ?? null;
		if (answer.resync) {
			console.error('the catch-up answered resync');
			break;
		}
		if (!answer.hasMore) break;
		position = { after: answer.cursor, afterId: answer.cursorId };
	}

	const liveOk = liveMs !== null && liveMs <= targetMs;
	console.log(`live: ${liveMs === null ? `not received within ${waitMs} ms` : `${liveMs} ms`} (target ${targetMs} ms) — ${liveOk ? 'PASS' : 'FAIL'}`);
	console.log(`catch-up replay: ${replayed ? `PASS (${replayed.eventId})` : 'FAIL'}`);
	return liveOk && replayed ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('realtime-live-check.mjs')) {
	main().then(
		(code) => process.exit(code),
		(error) => {
			console.error(error.message);
			process.exit(1);
		}
	);
}
