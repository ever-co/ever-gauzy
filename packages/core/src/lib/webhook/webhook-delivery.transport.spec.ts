import * as dns from 'node:dns';
import * as dnsPromises from 'node:dns/promises';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { WebhookDeliveryStatus } from '@gauzy/contracts';
import { WebhookDeliveryService } from './webhook-delivery.service';

/**
 * The attempt itself, on a real socket (R1-04 / R7-07 and R1-05 / R7-08 of the #10254 review).
 *
 * **Rebinding.** The policy resolved the endpoint's host with `dns.lookup`, and then `fetch` resolved it
 * again on its own when it connected — so the address that was checked and the address that was called
 * were two answers to two questions. A name whose resolver answers a public address to the first and a
 * private one to the second passed the check and reached the private address. The fix is held to "the
 * address checked is the address connected to": the connection's own lookup applies the policy.
 *
 * **The response body.** The attempt read the receiver's whole body (`response.text()`) and only then kept
 * four kilobytes of it. A receiver that streams for the whole ten-second window made the API process buffer
 * all of it — every tenant served by that process paid for one tenant's endpoint. The fix is held to "read up
 * to the limit, then hang up": the attempt answers with the first four kilobytes while the receiver is
 * still streaming, and the receiver sees the connection closed.
 *
 * Both run against a real HTTP server on the loopback interface, so what is asserted is what reached a
 * socket rather than what a stubbed client was asked to do.
 */

const SECRET = 'whsec_transport_fixture';
const LIMIT = WebhookDeliveryService.RESPONSE_BODY_LIMIT;

interface IReceiver {
	server: Server;
	port: number;
	requests: number;
	closedEarly: Promise<boolean>;
}

/** A receiver on 127.0.0.1 that answers with `handler`. */
async function receiver(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<IReceiver> {
	let markClosed: (value: boolean) => void = () => undefined;
	const state: IReceiver = {
		server: undefined as never,
		port: 0,
		requests: 0,
		closedEarly: new Promise<boolean>((resolve) => (markClosed = resolve))
	};
	state.server = createServer((request, response) => {
		state.requests += 1;
		response.on('close', () => markClosed(!response.writableEnded));
		handler(request, response);
	});
	await new Promise<void>((resolve) => state.server.listen(0, '127.0.0.1', resolve));
	state.port = (state.server.address() as AddressInfo).port;

	return state;
}

async function close(state: IReceiver | undefined): Promise<void> {
	if (!state) return;
	state.server.closeAllConnections?.();
	await new Promise<void>((resolve) => state.server.close(() => resolve()));
}

/** The service under test, delivering one stored row to `url`. */
function deliveryTo(url: string) {
	const row: Record<string, any> = {
		id: 'delivery-1',
		subscriptionId: 'subscription-1',
		eventId: 'event-1',
		eventName: 'order.placed',
		payload: { id: 'event-1', name: 'order.placed', data: {} },
		status: WebhookDeliveryStatus.PENDING,
		attemptCount: 0,
		tenantId: 'tenant-1'
	};
	const table = {
		findOne: async () => row,
		save: async (saved: Record<string, any>) => Object.assign(row, saved)
	};
	const subscriptions = {
		getSubscription: async () => subscription,
		getSubscriptionForDelivery: async () => subscription,
		revealSecret: async () => SECRET,
		previousSecretOf: () => undefined,
		recordAttempt: jest.fn().mockResolvedValue(undefined)
	};
	const subscription = { id: 'subscription-1', url, isActive: true, apiVersion: '1', tenantId: 'tenant-1' };
	const publisher = { deliveryFailed: jest.fn().mockResolvedValue(true) };
	const service = new WebhookDeliveryService(table as never, {} as never, subscriptions as never, publisher as never);

	return { service, row, subscriptions, publisher };
}

let state: IReceiver | undefined;

afterEach(async () => {
	jest.restoreAllMocks();
	delete process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK;
	await close(state);
	state = undefined;
});

describe('the address checked is the address connected to (R1-04, R7-07)', () => {
	it('refuses a name that answers a public address to the check and a private one to the connection', async () => {
		state = await receiver((_request, response) => response.end('internal service answer'));

		// The rebinding resolver: whoever asks through the promise API (the policy's check) is told a
		// public address; whoever asks through the callback API (the socket's own lookup) is told loopback.
		jest.spyOn(dnsPromises, 'lookup').mockResolvedValue([{ address: '93.184.215.14', family: 4 }] as never);
		jest.spyOn(dns, 'lookup').mockImplementation(((
			_host: string,
			options: unknown,
			callback?: (...args: unknown[]) => void
		) => {
			const done = (typeof options === 'function' ? options : callback) as (...args: unknown[]) => void;
			const all = typeof options === 'object' && options !== null && (options as { all?: boolean }).all;

			return all ? done(null, [{ address: '127.0.0.1', family: 4 }]) : done(null, '127.0.0.1', 4);
		}) as never);

		const { service, publisher, subscriptions } = deliveryTo(`http://rebind.example.com:${state.port}/hook`);
		const attempt = await service.deliver('delivery-1');

		expect(state.requests).toBe(0);
		expect(attempt.delivery.status).toBe(WebhookDeliveryStatus.DEAD);
		expect(attempt.result.lastError).toMatch(/private, loopback or link-local/);
		// A refusal by policy is not the endpoint's failure: the subscription's counters are not moved.
		expect(subscriptions.recordAttempt).not.toHaveBeenCalled();
		expect(publisher.deliveryFailed).toHaveBeenCalledTimes(1);
	});

	it('connects to a name whose every answer is public — control', async () => {
		state = await receiver((_request, response) => response.end('ok'));
		// The installation allows private endpoints, so the loopback receiver stands in for a partner.
		process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';
		jest.spyOn(dns, 'lookup').mockImplementation(((
			_host: string,
			options: unknown,
			callback?: (...args: unknown[]) => void
		) => {
			const done = (typeof options === 'function' ? options : callback) as (...args: unknown[]) => void;
			const all = typeof options === 'object' && options !== null && (options as { all?: boolean }).all;

			return all ? done(null, [{ address: '127.0.0.1', family: 4 }]) : done(null, '127.0.0.1', 4);
		}) as never);

		const { service } = deliveryTo(`http://partner.example.com:${state.port}/hook`);
		const attempt = await service.deliver('delivery-1');

		expect(state.requests).toBe(1);
		expect(attempt.delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
	});
});

describe('the receiver’s response is read up to the limit, then the connection is closed (R1-05, R7-08)', () => {
	it('answers with the first four kilobytes of an endless body, long before the attempt times out', async () => {
		process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';
		const chunk = Buffer.alloc(64 * 1024, 'x');
		state = await receiver((_request, response) => {
			response.writeHead(200, { 'Content-Type': 'text/plain' });
			// Streams until the client hangs up: a body that never ends.
			const pump = () => {
				while (!response.destroyed && response.write(chunk)) {
					/* keep writing until the socket pushes back */
				}
				if (!response.destroyed) response.once('drain', pump);
			};
			pump();
		});

		const startedAt = Date.now();
		const { service } = deliveryTo(`http://127.0.0.1:${state.port}/hook`);
		const attempt = await service.deliver('delivery-1');

		expect(attempt.result.responseStatus).toBe(200);
		expect(attempt.result.delivered).toBe(true);
		expect(Buffer.byteLength(attempt.result.responseBody ?? '')).toBe(LIMIT);
		expect(Date.now() - startedAt).toBeLessThan(WebhookDeliveryService.REQUEST_TIMEOUT_MS / 2);
		expect(await state.closedEarly).toBe(true);
	}, 30_000);

	it('keeps a short body whole and does not follow a redirect — control', async () => {
		process.env.GAUZY_WEBHOOK_ALLOW_PRIVATE_NETWORK = 'true';
		state = await receiver((request, response) => {
			if (request.url === '/moved') {
				response.writeHead(302, { Location: `http://127.0.0.1:${state?.port}/hook` });
				response.end();
				return;
			}
			response.end('accepted');
		});

		const accepted = await deliveryTo(`http://127.0.0.1:${state.port}/hook`).service.deliver('delivery-1');
		expect(accepted.result.responseBody).toBe('accepted');

		const moved = await deliveryTo(`http://127.0.0.1:${state.port}/moved`).service.deliver('delivery-1');
		expect(moved.result.responseStatus).toBe(302);
		expect(moved.result.delivered).toBe(false);
		expect(state.requests).toBe(2);
	});
});
