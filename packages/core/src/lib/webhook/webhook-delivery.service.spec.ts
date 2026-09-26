import { NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { validateSync } from 'class-validator';
import { WebhookDeliveryStatus, WebhookHeader } from '@gauzy/contracts';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { verifyWebhookSignature } from './webhook-signature';
import { TypeOrmWebhookDeliveryRepository } from './repository/type-orm-webhook-delivery.repository';

/**
 * Outbound delivery, attempt accounting and the retry schedule.
 *
 * A delivery is one row per `(subscription, event)` whose payload is written once and never rebuilt,
 * and every attempt is recorded on it: the status the endpoint answered, how long it took, and when
 * the next attempt is due. The cases here assert the schedule the platform publishes — the immediate
 * attempt, then `+5 s`, `+30 s`, `+2 min`, `+10 min`, `+1 h`, `+6 h`, then `DEAD` — that a refusal
 * which will not change is dead-lettered at once, and that the bytes on the wire are the bytes that
 * were signed, so a receiver reproducing the digest accepts them.
 *
 * Nothing leaves the process: the HTTP client is a stub, and the clock is pinned so every scheduled
 * instant is asserted rather than waited for.
 */

type Row = Record<string, any>;

const SECRET = 'whsec_test_fixture_2f8c1d';
const SUBSCRIPTION_ID = '6b1e0f2a-0000-4000-8000-000000000002';
const EVENT_ID = '6b1e0f2a-0000-4000-8000-000000000001';
const T0 = new Date('2026-03-01T10:00:00Z');

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint "UQ_webhook_delivery"'), {
		code: '23505'
	});
}

/** An in-memory stand-in for the `webhook_delivery` table. */
class DeliveryTable {
	readonly rows: Row[] = [];
	private sequence = 0;

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `delivery-${this.sequence}`, ...input };
	}

	async save(row: Row): Promise<Row> {
		// One delivery per event per subscription, which is what makes the dispatcher idempotent.
		const clash = this.rows.find(
			(existing) =>
				existing.id !== row.id &&
				existing.subscriptionId === row.subscriptionId &&
				existing.eventId === row.eventId
		);

		if (clash) {
			throw uniqueViolation();
		}

		const existing = this.rows.findIndex((entry) => entry.id === row.id);

		if (existing === -1) {
			this.rows.push(row);
		} else {
			this.rows[existing] = row;
		}

		return row;
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => matches(row, options.where ?? {})) ?? null;
	}

	createQueryBuilder(alias: string) {
		const conditions: { clause: string; params: Row }[] = [];
		const ordering: { column: string; direction: string }[] = [];
		let limit: number | undefined;

		const filtered = () => this.rows.filter((row) => evaluate(row, conditions));

		const builder = {
			where: (clause: string, params: Row = {}) => {
				conditions.push({ clause, params });

				return builder;
			},
			andWhere: (clause: string, params: Row = {}) => {
				conditions.push({ clause, params });

				return builder;
			},
			orderBy: (column: string, direction: string) => {
				ordering.push({ column: unqualify(column, alias), direction });

				return builder;
			},
			addOrderBy: (column: string, direction: string) => {
				ordering.push({ column: unqualify(column, alias), direction });

				return builder;
			},
			limit: (value: number) => {
				limit = value;

				return builder;
			},
			setLock: (_mode: string) => builder,
			getMany: async () => filtered().sort(byOrder(ordering)).slice(0, limit ?? Number.MAX_SAFE_INTEGER),
			getOne: async () => filtered()[0] ?? null
		};

		return builder;
	}
}

function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => (row[column] ?? null) === (condition ?? null));
}

/** Reads the `delivery.column <op> :param` and `IN (:...param)` clauses the due scan builds. */
function evaluate(row: Row, conditions: { clause: string; params: Row }[]): boolean {
	return conditions.every(({ clause, params }) => {
		const inClause = /(\w+)\.(\w+)\s+IN\s*\(:\.\.\.(\w+)\)/.exec(clause);

		if (inClause) {
			return (params[inClause[3]] as unknown[]).includes(row[inClause[2]]);
		}

		const parsed = /(\w+)\.(\w+)\s*(<=|>=|<>|=|<|>)\s*:(\w+)/.exec(clause);

		if (!parsed) {
			throw new Error(`The in-memory query builder cannot read the clause "${clause}"`);
		}

		const [, , column, operator, parameter] = parsed;
		const left = instant(row[column]);
		const right = instant(params[parameter]);

		switch (operator) {
			case '=':
				return left === right;
			case '<>':
				return left !== right;
			case '<=':
				return left <= right;
			case '>=':
				return left >= right;
			case '<':
				return left < right;
			default:
				return left > right;
		}
	});
}

function instant(value: unknown): any {
	return value instanceof Date ? value.getTime() : value;
}

function unqualify(column: string, alias: string): string {
	return column.startsWith(`${alias}.`) ? column.slice(alias.length + 1) : column;
}

function byOrder(ordering: { column: string; direction: string }[]): (left: Row, right: Row) => number {
	return (left, right) => {
		for (const { column, direction } of ordering) {
			if (instant(left[column]) === instant(right[column])) {
				continue;
			}

			return (instant(left[column]) > instant(right[column]) ? 1 : -1) * (direction === 'DESC' ? -1 : 1);
		}

		return 0;
	};
}

/** The subscription service as the delivery path uses it: the row, the secret and the counters. */
function subscriptions(row: Row = {}) {
	const subscription = {
		id: SUBSCRIPTION_ID,
		url: 'https://receiver.example.test/hooks/orders',
		isActive: true,
		apiVersion: '1',
		headers: undefined,
		failureCount: 0,
		...row
	};
	const attempts: { delivered: boolean; status?: number }[] = [];

	const service = {
		async getSubscription() {
			return subscription;
		},
		async revealSecret() {
			return SECRET;
		},
		previousSecretOf() {
			return undefined;
		},
		async recordAttempt(_id: string, outcome: { delivered: boolean; status?: number }) {
			attempts.push(outcome);

			return subscription;
		}
	};

	return { service, subscription, attempts };
}

/** What the platform's HTTP client answers, and what it was asked to send. */
function http(status: number, body = '', ok = status >= 200 && status < 300) {
	const calls: { url: string; init: Row }[] = [];

	globalThis.fetch = (async (url: string, init: Row) => {
		calls.push({ url, init });

		return { ok, status, text: async () => body };
	}) as unknown as typeof fetch;

	return calls;
}

/** The service under test, with the table it writes to and the subscription it delivers for. */
function deliveries(subscription: Row = {}) {
	const table = new DeliveryTable();
	const { service: subscriptionService, attempts } = subscriptions(subscription);

	const service = new WebhookDeliveryService(
		table as unknown as TypeOrmWebhookDeliveryRepository,
		{} as never,
		subscriptionService as unknown as WebhookSubscriptionService,
		// The publisher is doubled rather than left out: a refused attempt is announced from the
		// service, and a suite about the attempt is not a suite about the fan-out. What it announces is
		// asserted where the two surfaces are, in `webhook.resolver.spec.ts`.
		{ deliveryFailed: jest.fn().mockResolvedValue(true) } as never
	);

	return { service, table, attempts };
}

/** One due delivery row, so a case can vary exactly one thing. */
const delivery = (table: DeliveryTable, overrides: Row = {}): Row =>
	table.create({
		subscriptionId: SUBSCRIPTION_ID,
		eventId: EVENT_ID,
		eventName: 'order.placed',
		payload: { id: EVENT_ID, name: 'order.placed', data: { orderId: 'order-1' } },
		status: WebhookDeliveryStatus.PENDING,
		attemptCount: 0,
		nextAttemptAt: T0,
		tenantId: 'tenant-1',
		...overrides
	});

/** The payload the body was sent for, as the receiver would read it. */
const bodyOf = (calls: { init: Row }[]): string => String(calls[0].init.body);

/** The process's own client, so a stubbed one never leaks out of this suite. */
const originalFetch = globalThis.fetch;

beforeEach(() => {
	jest.useFakeTimers();
	jest.setSystemTime(T0);
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('the delivery row', () => {
	it('accepts a row the delivery path writes and refuses a status outside the vocabulary', () => {
		const row = () =>
			Object.assign(new WebhookDelivery(), {
				subscriptionId: SUBSCRIPTION_ID,
				eventId: EVENT_ID,
				eventName: 'order.placed',
				payload: {},
				status: WebhookDeliveryStatus.PENDING,
				attemptCount: 0
			});

		expect(validateSync(row()).map((error) => error.property)).toEqual([]);
		// The terminal vocabulary is `DEAD`; a delivery is only ever parked once there is nothing left
		// to try, so a status the column does not declare is refused rather than stored.
		expect(validateSync(Object.assign(row(), { status: 'PARKED' })).map((error) => error.property)).toEqual([
			'status'
		]);
		expect(Object.values(WebhookDeliveryStatus)).toEqual(['PENDING', 'DELIVERED', 'FAILED', 'DEAD']);
	});
});

describe('one attempt', () => {
	it('records a delivery the endpoint accepted, and schedules nothing further', async () => {
		const calls = http(200, 'ok');
		const { service, table, attempts } = deliveries();
		const row = delivery(table);
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);

		expect(attempt.skipped).toBe(false);
		expect(attempt.delivery).toMatchObject({
			status: WebhookDeliveryStatus.DELIVERED,
			attemptCount: 1,
			responseStatus: 200,
			responseBody: 'ok',
			nextAttemptAt: null,
			lastError: null
		});
		expect(attempt.delivery.deliveredAt).toEqual(T0);
		expect(attempts).toEqual([{ delivered: true, status: 200 }]);
		expect(calls[0].url).toBe('https://receiver.example.test/hooks/orders');
	});

	it('schedules the next attempt on the documented ladder, jittered around the step', async () => {
		http(503, 'unavailable');
		const { service, table } = deliveries();
		const row = delivery(table);
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);
		const delay = new Date(attempt.delivery.nextAttemptAt as Date).getTime() - T0.getTime();

		expect(attempt.delivery).toMatchObject({
			status: WebhookDeliveryStatus.FAILED,
			attemptCount: 1,
			responseStatus: 503,
			lastError: 'The endpoint answered 503.'
		});
		expect(delay).toBeGreaterThanOrEqual(Math.floor(WebhookDeliveryService.RETRY_LADDER_MS[0] * 0.8));
		expect(delay).toBeLessThanOrEqual(Math.ceil(WebhookDeliveryService.RETRY_LADDER_MS[0] * 1.2));
		// The schedule is the one the platform publishes: seven attempts, the immediate one included.
		expect(WebhookDeliveryService.RETRY_LADDER_MS).toEqual([5_000, 30_000, 120_000, 600_000, 3_600_000, 21_600_000]);
		expect(WebhookDeliveryService.MAX_ATTEMPTS).toBe(7);
	});

	it('dead-letters the delivery when the schedule runs out', async () => {
		http(500, 'boom');
		const { service, table } = deliveries();
		const row = delivery(table, { attemptCount: 6, status: WebhookDeliveryStatus.FAILED });
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);

		// Dead is terminal and is reached only when there is nothing left to try.
		expect(attempt.delivery).toMatchObject({
			status: WebhookDeliveryStatus.DEAD,
			attemptCount: 7,
			nextAttemptAt: null
		});
	});

	it('dead-letters a refusal that will not change, and retries one that might', async () => {
		// Control: a delivery that treats every failure as retryable would hammer an endpoint that has
		// already answered "this request is unacceptable" seven more times.
		expect(WebhookDeliveryService.isRetryable(400)).toBe(false);
		expect(WebhookDeliveryService.isRetryable(401)).toBe(false);
		expect(WebhookDeliveryService.isRetryable(404)).toBe(false);
		expect(WebhookDeliveryService.isRetryable(429)).toBe(true);
		expect(WebhookDeliveryService.isRetryable(408)).toBe(true);
		expect(WebhookDeliveryService.isRetryable(425)).toBe(true);
		expect(WebhookDeliveryService.isRetryable(500)).toBe(true);
		// A redirect is not followed, so it counts as a failure the platform may retry.
		expect(WebhookDeliveryService.isRetryable(302)).toBe(true);
		// A transport error never completed, so there is no status to judge it by.
		expect(WebhookDeliveryService.isRetryable(undefined)).toBe(true);

		http(400, 'bad request');
		const refused = deliveries();
		const refusedRow = delivery(refused.table);
		refused.table.rows.push(refusedRow);

		expect((await refused.service.deliver(refusedRow.id as string)).delivery.status).toBe(WebhookDeliveryStatus.DEAD);

		http(429, 'slow down');
		const throttled = deliveries();
		const throttledRow = delivery(throttled.table);
		throttled.table.rows.push(throttledRow);

		expect((await throttled.service.deliver(throttledRow.id as string)).delivery.status).toBe(
			WebhookDeliveryStatus.FAILED
		);
	});

	it('reports a transport failure as a retryable attempt rather than as a delivered one', async () => {
		const calls: string[] = [];

		globalThis.fetch = (async (url: string) => {
			calls.push(url);

			throw new Error('getaddrinfo ENOTFOUND receiver.example.test');
		}) as unknown as typeof fetch;

		const { service, table } = deliveries();
		const row = delivery(table);
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);

		expect(attempt.result.delivered).toBe(false);
		expect(attempt.delivery).toMatchObject({
			status: WebhookDeliveryStatus.FAILED,
			lastError: 'getaddrinfo ENOTFOUND receiver.example.test'
		});
		expect(calls).toHaveLength(1);
	});

	it('does not call a disabled subscription at all, and records why', async () => {
		const calls = http(200);
		const { service, table } = deliveries({ isActive: false, disabledAt: T0 });
		const row = delivery(table);
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);

		// Control: the operator switched the endpoint off, so calling it would be a request nobody
		// asked for — and the delivery is recorded as dead so the backlog stays readable.
		expect(calls).toHaveLength(0);
		expect(attempt.skipped).toBe(true);
		expect(attempt.delivery).toMatchObject({ status: WebhookDeliveryStatus.DEAD, lastError: 'SUBSCRIPTION_DISABLED' });
	});

	it('refuses a delivery that does not exist', async () => {
		http(200);
		const { service } = deliveries();

		await expect(service.deliver('delivery-404')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('what goes on the wire', () => {
	it('signs the exact bytes it sends, so a receiver reproducing the digest accepts them', async () => {
		const calls = http(200);
		const { service, table } = deliveries();
		const row = delivery(table);
		table.rows.push(row);

		await service.deliver(row.id as string);

		const body = bodyOf(calls);
		const headers = calls[0].init.headers as Row;
		const signature = String(headers[WebhookHeader.SIGNATURE]);

		// The body is the stored payload, serialised once: a retry or a replay months later sends
		// exactly what was intended.
		expect(body).toBe(JSON.stringify(row.payload));
		expect(verifyWebhookSignature(SECRET, body, signature, { now: Math.floor(T0.getTime() / 1000) })).toBe(true);

		const timestamp = Number(signature.split('t=')[1].split(',')[0]);

		expect(signature.split('v1=')[1]).toBe(
			createHmac('sha256', SECRET).update(`${timestamp}.${body}`, 'utf8').digest('hex')
		);
		// A body that changed in flight stops verifying, which is the point of signing the bytes.
		expect(verifyWebhookSignature(SECRET, `${body} `, signature, { now: timestamp })).toBe(false);

		expect(headers[WebhookHeader.EVENT]).toBe('order.placed');
		expect(headers[WebhookHeader.EVENT_ID]).toBe(EVENT_ID);
		expect(headers[WebhookHeader.DELIVERY]).toBe(`${row.id}.1`);
		expect(headers[WebhookHeader.ATTEMPT]).toBe('1');
		expect(headers[WebhookHeader.API_VERSION]).toBe('1');
		expect(headers[WebhookHeader.TENANT]).toBe('tenant-1');
		expect(headers['User-Agent']).toBe(WebhookDeliveryService.USER_AGENT);
		expect(calls[0].init.redirect).toBe('manual');
	});

	it('never lets a subscription’s own headers override a reserved one', async () => {
		const calls = http(200);
		const { service, table } = deliveries({ headers: { 'X-Signature': 'forged', 'X-Delivery': 'forged', 'X-Trace': 'abc' } });
		const row = delivery(table);
		table.rows.push(row);

		await service.deliver(row.id as string);

		const headers = calls[0].init.headers as Row;

		// Control: a subscription that could overwrite the signature could make its own deliveries
		// unverifiable, and one that could overwrite the delivery id could defeat replay detection.
		expect(headers[WebhookHeader.SIGNATURE] === 'forged').toBe(false);
		expect(headers[WebhookHeader.DELIVERY]).toBe(`${row.id}.1`);
		// The routing hints a receiver needs are still carried.
		expect(headers['X-Trace']).toBe('abc');
	});

	it('counts the attempt in the header and in the delivery id, one-based', async () => {
		const calls = http(500, 'boom');
		const { service, table } = deliveries();
		const row = delivery(table, { attemptCount: 2, status: WebhookDeliveryStatus.FAILED });
		table.rows.push(row);

		await service.deliver(row.id as string);

		const headers = calls[0].init.headers as Row;

		expect(headers[WebhookHeader.ATTEMPT]).toBe('3');
		expect(headers[WebhookHeader.DELIVERY]).toBe(`${row.id}.3`);
	});

	it('keeps only the first four kilobytes of a response, so a huge body cannot hold the worker', async () => {
		http(500, 'x'.repeat(WebhookDeliveryService.RESPONSE_BODY_LIMIT + 1_000));
		const { service, table } = deliveries();
		const row = delivery(table);
		table.rows.push(row);

		const attempt = await service.deliver(row.id as string);

		expect(String(attempt.delivery.responseBody)).toHaveLength(WebhookDeliveryService.RESPONSE_BODY_LIMIT);
		expect(attempt.delivery.durationMs).toBeGreaterThanOrEqual(0);
	});
});

describe('the deliveries that are due', () => {
	it('returns the pending and failed ones whose time has come, soonest first, bounded by the limit', async () => {
		http(200);
		const { service, table } = deliveries();

		table.rows.push(
			delivery(table, { eventId: 'event-later', nextAttemptAt: new Date(T0.getTime() + 60_000) }),
			delivery(table, { eventId: 'event-second', nextAttemptAt: T0, attemptCount: 1, status: WebhookDeliveryStatus.FAILED }),
			delivery(table, { eventId: 'event-first', nextAttemptAt: new Date(T0.getTime() - 60_000) }),
			delivery(table, { eventId: 'event-done', status: WebhookDeliveryStatus.DELIVERED, nextAttemptAt: null })
		);

		const due = await service.findDue(10, T0);

		expect(due.map((row) => row.eventId)).toEqual(['event-first', 'event-second']);
		expect((await service.findDue(1, T0)).map((row) => row.eventId)).toEqual(['event-first']);
	});

	it('creates one delivery per event and reports the existing one when the pass is re-run', async () => {
		http(200);
		const { service, table } = deliveries();
		const payload = { id: EVENT_ID, name: 'order.placed', data: {} };

		const first = await service.enqueue({ subscriptionId: SUBSCRIPTION_ID, eventId: EVENT_ID, eventName: 'order.placed', payload });
		const second = await service.enqueue({ subscriptionId: SUBSCRIPTION_ID, eventId: EVENT_ID, eventName: 'order.placed', payload });

		// Control: a re-run of the dispatch pass must not create a second delivery, or the same event
		// would be sent twice for one subscription.
		expect(first.created).toBe(true);
		expect(second.created).toBe(false);
		expect(second.delivery.id).toBe(first.delivery.id);
		expect(table.rows).toHaveLength(1);
		expect(await service.findByEvent(SUBSCRIPTION_ID, EVENT_ID)).toMatchObject({ id: first.delivery.id });
	});

	it('stamps the delivery row with the columns a listing reads', async () => {
		http(200);
		const { service, table } = deliveries();
		const payload = { id: EVENT_ID, name: 'order.placed', data: {} };

		const { delivery: created } = await service.enqueue({
			subscriptionId: SUBSCRIPTION_ID,
			eventId: EVENT_ID,
			eventName: 'order.placed',
			payload,
			tenantId: 'tenant-1'
		});

		expect(created).toMatchObject({
			status: WebhookDeliveryStatus.PENDING,
			attemptCount: 0,
			tenantId: 'tenant-1'
		});
		// The first attempt is due immediately; the ladder applies from the second one.
		expect(new Date(created.nextAttemptAt as Date).getTime()).toBeLessThanOrEqual(T0.getTime());
		expect(created.payload).toBe(payload);
		expect(table.rows).toHaveLength(1);
	});
});
