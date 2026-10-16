// cspell:ignore whsec
/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { WebhookDeliveryStatus } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { WebhookTransport } from './webhook-transport';

/**
 * One delivery row is posted by one attempt, against a real better-sqlite3 store (#10696).
 *
 * **The defect.** The retry pass read its due rows once and posted each of them without asking whether
 * the row was still pending or failed and due. A row the fan-out was still sending, or one an overlapping
 * pass had already taken, reached the partner twice. The fan-out and the retry pass now claim the row
 * with one conditional write before the endpoint is called, and the store settles the race.
 *
 * The store is real because the claim is one `UPDATE … WHERE` over a status list, an attempt count and a
 * timestamp: whether it matches is the database's answer, not a double's.
 */

const SUBSCRIPTION_ID = '6b1e0f2a-0000-4000-8000-000000000002';
const SECRET = 'whsec_claim_fixture_7d3a9e';

/** The `webhook_delivery` columns the service reads and writes. */
const DeliverySchema = new EntitySchema<Record<string, any>>({
	name: 'WebhookDeliveryClaimFixture',
	tableName: 'webhook_delivery',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		subscriptionId: { type: 'varchar' },
		eventId: { type: 'varchar' },
		eventName: { type: 'varchar' },
		payload: { type: 'simple-json' },
		status: { type: 'varchar' },
		attemptCount: { type: 'int', default: 0 },
		responseStatus: { type: 'int', nullable: true },
		responseBody: { type: 'text', nullable: true },
		durationMs: { type: 'int', nullable: true },
		deliveredAt: { type: 'datetime', nullable: true },
		nextAttemptAt: { type: 'datetime', nullable: true },
		lastError: { type: 'text', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

/** What the partner answers: accepted. */
const ACCEPTED = { ok: true, status: 200, body: 'ok', truncated: false };

let dataSource: DataSource;
let rows: Repository<Record<string, any>>;
let service: WebhookDeliveryService;
let post: jest.SpyInstance;
let getSubscriptionForDelivery: jest.Mock;

beforeEach(async () => {
	dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [DeliverySchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	rows = dataSource.getRepository(DeliverySchema);

	getSubscriptionForDelivery = jest.fn().mockResolvedValue({
		id: SUBSCRIPTION_ID,
		url: 'https://receiver.example.test/hooks/orders',
		isActive: true,
		apiVersion: '1',
		headers: undefined,
		failureCount: 0
	});
	const subscriptions = {
		getSubscriptionForDelivery,
		revealSecret: jest.fn().mockResolvedValue(SECRET),
		previousSecretOf: jest.fn().mockReturnValue(undefined),
		recordAttempt: jest.fn().mockResolvedValue(undefined)
	};

	service = new WebhookDeliveryService(
		rows as never,
		{} as never,
		subscriptions as unknown as WebhookSubscriptionService,
		{ deliveryFailed: jest.fn().mockResolvedValue(true) } as never
	);

	// Nothing leaves the process: the endpoint policy's DNS lookup and the HTTP client are both stood in for.
	jest.spyOn(WebhookDeliveryService.prototype as never, 'refuseUnroutableEndpoint').mockResolvedValue(
		undefined as never
	);
	post = jest.spyOn(WebhookTransport.prototype, 'post').mockResolvedValue(ACCEPTED as never);
});

afterEach(async () => {
	jest.restoreAllMocks();
	await dataSource.destroy();
});

/** One delivery row, due now unless stated otherwise. */
async function seed(overrides: Record<string, unknown> = {}): Promise<Record<string, any>> {
	return rows.save({
		subscriptionId: SUBSCRIPTION_ID,
		eventId: 'e0000000-0000-4000-8000-000000000001',
		eventName: 'order.placed',
		payload: { data: { orderId: 'order-1' } },
		status: WebhookDeliveryStatus.PENDING,
		attemptCount: 0,
		nextAttemptAt: new Date(Date.now() - 1_000),
		tenantId: 'tenant-1',
		...overrides
	});
}

/** The row as the store now holds it. */
async function stored(id: string): Promise<Record<string, any>> {
	return (await rows.findOne({ where: { id } })) as Record<string, any>;
}

/** Lets pending promise callbacks run until `done` holds, or gives up. */
async function until(done: () => boolean): Promise<void> {
	for (let turn = 0; turn < 200 && !done(); turn += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}
}

describe('WebhookDeliveryService — one attempt holds a delivery row', () => {
	it('does not post a row the fan-out is still sending when the retry pass reaches it', async () => {
		const row = await seed();
		let answer!: (value: unknown) => void;

		post.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));

		// The fan-out's first attempt, still waiting for the partner.
		const fanOut = service.deliver(row.id, { claim: true });
		await until(() => post.mock.calls.length > 0);

		// The retry pass read the row as due before the fan-out took it, and reaches it now.
		const retry = await service.deliver(row.id, { claim: true });

		answer(ACCEPTED);
		const first = await fanOut;

		expect(retry.claimRefused).toBe(true);
		expect(retry.skipped).toBe(true);
		expect(post).toHaveBeenCalledTimes(1);
		expect(first.delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
		expect(await stored(row.id)).toMatchObject({ status: WebhookDeliveryStatus.DELIVERED, attemptCount: 1 });
	});

	it('does not post a row another pass already delivered from the snapshot it read before', async () => {
		const row = await seed();
		const snapshot = await stored(row.id);

		await service.deliver(row.id, { claim: true });
		// The overlapping pass read the row before the first one wrote its outcome.
		jest.spyOn(rows, 'findOne').mockResolvedValueOnce(snapshot);

		const overlapping = await service.deliver(row.id, { claim: true });

		expect(overlapping.claimRefused).toBe(true);
		expect(post).toHaveBeenCalledTimes(1);
		expect(await stored(row.id)).toMatchObject({ status: WebhookDeliveryStatus.DELIVERED, attemptCount: 1 });
	});

	it('does not post a row that is not due yet, and leaves it as it was', async () => {
		const later = new Date(Date.now() + 5 * 60_000);
		const row = await seed({ status: WebhookDeliveryStatus.FAILED, attemptCount: 2, nextAttemptAt: later });

		const attempt = await service.deliver(row.id, { claim: true });

		expect(attempt.claimRefused).toBe(true);
		expect(post).not.toHaveBeenCalled();
		expect(await stored(row.id)).toMatchObject({ status: WebhookDeliveryStatus.FAILED, attemptCount: 2 });
		expect(new Date((await stored(row.id)).nextAttemptAt).getTime()).toBe(later.getTime());
	});

	it('does not post a row whose attempt moved on since it was read', async () => {
		const row = await seed({ status: WebhookDeliveryStatus.FAILED, attemptCount: 1 });
		// The pass read attempt 0; another attempt has recorded attempt 1 since, and the row is due again.
		jest.spyOn(rows, 'findOne').mockResolvedValueOnce({ ...(await stored(row.id)), attemptCount: 0 });

		const attempt = await service.deliver(row.id, { claim: true });

		expect(attempt.claimRefused).toBe(true);
		expect(post).not.toHaveBeenCalled();
	});

	it('hands a row whose attempt died midway back to the retry pass once the lease runs out', async () => {
		const row = await seed();
		const now = Date.now();

		getSubscriptionForDelivery.mockRejectedValueOnce(new Error('connection terminated unexpectedly'));
		await expect(service.deliver(row.id, { claim: true })).rejects.toThrow('connection terminated unexpectedly');

		// Held: the retry scan does not return it while the lease runs.
		expect((await service.findDue(50, new Date(now + 1_000))).map((due) => due.id)).toEqual([]);

		const afterLease = now + WebhookDeliveryService.ATTEMPT_LEASE_MS + 2_000;
		expect((await service.findDue(50, new Date(afterLease))).map((due) => due.id)).toEqual([row.id]);

		jest.spyOn(Date, 'now').mockReturnValue(afterLease);
		const attempt = await service.deliver(row.id, { claim: true });

		expect(attempt.claimRefused).toBeUndefined();
		expect(post).toHaveBeenCalledTimes(1);
		expect(await stored(row.id)).toMatchObject({ status: WebhookDeliveryStatus.DELIVERED, attemptCount: 1 });
	});

	it('still posts a row that is not due when no claim is asked for, as a direct attempt did before', async () => {
		const row = await seed({ nextAttemptAt: new Date(Date.now() + 5 * 60_000) });

		const attempt = await service.deliver(row.id);

		expect(attempt.skipped).toBe(false);
		expect(post).toHaveBeenCalledTimes(1);
	});
});
