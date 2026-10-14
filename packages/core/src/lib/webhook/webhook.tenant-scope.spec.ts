/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { WebhookDeliveryStatus } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { EncryptionService } from '../common/encryption/encryption.service';
import { RequestContext } from '../core/context/request-context';
import { WebhookDeliveryController } from './webhook-delivery.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookResolver } from './webhook.resolver';
import { WebhookSubscriptionController } from './webhook-subscription.controller';
import { WebhookSubscriptionService } from './webhook-subscription.service';

/**
 * Webhook subscriptions and deliveries are addressed by id **inside the caller's scope only**, on
 * both protocols, against a real better-sqlite3 store (R1-01, R1-02 of the #10254 review).
 *
 * **The defect.** Both services extend the plain `CrudService`, and every id-addressed operation read
 * its row with `findOne({ where: { id } })` — no tenant, no organization. `TenantPermissionGuard`
 * only compares the `Tenant-Id` header with the caller's own tenant, so nothing stood between a
 * tenant-A admin and tenant B's rows but B's UUID: `PUT /webhooks/subscriptions/<B>` re-pointed B's
 * endpoint (and with it every future event of B) at a URL of A's choosing, `rotate-secret` answered
 * B's new plaintext signing secret, `GET` answered B's URL and custom headers, `DELETE` removed B's
 * subscription and its delivery log by cascade, and the delivery log's read and redelivery reached
 * B's rows the same way. Only the two list reads were scoped.
 *
 * **What the fix is held to.** A row the caller cannot list is a row the caller cannot address: every
 * request-facing id read narrows on the same tenant and organization the list narrows on, and a row
 * outside it answers exactly what a missing row answers (`404` over REST, `null` / not-found over
 * GraphQL) — a caller is never told that another tenant holds the identifier. The delivery runtime,
 * which runs in a queue worker with no caller, keeps an explicitly unscoped reader of its own.
 *
 * **Every refusal has a control.** Tenant B's own caller reaches the same row through the same route,
 * so a `404` here is the scope and not a row that was never there; and tenant B's row is re-read from
 * the store after every refused write, so "refused" means "nothing changed" rather than "threw after
 * writing".
 *
 * The store is the platform's dialect with the platform's own `invalidWhereValuesBehavior`, so a
 * `null` organization in a criterion means `IS NULL` here exactly as it does in production.
 */

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ORG_A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
const ORG_B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';

/** The `webhook_subscription` columns the service reads and writes. */
const SubscriptionSchema = new EntitySchema<Record<string, any>>({
	name: 'WebhookSubscriptionScopeFixture',
	tableName: 'webhook_subscription',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		name: { type: 'varchar' },
		url: { type: 'varchar' },
		secret: { type: 'varchar' },
		events: { type: 'simple-json' },
		channelId: { type: 'varchar', nullable: true },
		description: { type: 'text', nullable: true },
		headers: { type: 'simple-json', nullable: true },
		apiVersion: { type: 'varchar', nullable: true },
		metadata: { type: 'simple-json', nullable: true },
		failureCount: { type: 'int', default: 0 },
		lastSuccessAt: { type: 'datetime', nullable: true },
		lastFailureAt: { type: 'datetime', nullable: true },
		disabledAt: { type: 'datetime', nullable: true },
		isActive: { type: 'boolean', default: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

/** The `webhook_delivery` columns the service reads and writes. */
const DeliverySchema = new EntitySchema<Record<string, any>>({
	name: 'WebhookDeliveryScopeFixture',
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

interface IFixture {
	dataSource: DataSource;
	subscriptionRows: Repository<Record<string, any>>;
	deliveryRows: Repository<Record<string, any>>;
	subscriptionService: WebhookSubscriptionService;
	deliveryService: WebhookDeliveryService;
	rest: { subscriptions: WebhookSubscriptionController; deliveries: WebhookDeliveryController };
	graphql: WebhookResolver;
	/** Tenant A's subscription in organization A1. */
	ownSubscriptionId: string;
	/** Tenant B's subscription in organization B1: the row every cross-tenant case reaches for. */
	foreignSubscriptionId: string;
	ownDeliveryId: string;
	foreignDeliveryId: string;
	/** Tenant A's tenant-wide subscription and delivery (no organization). */
	tenantWideSubscriptionId: string;
	tenantWideDeliveryId: string;
}

/** Acts as a signed-in user of one tenant and, optionally, one organization. */
function actAs(tenantId: string | null, organizationId: string | null = null): void {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId as never);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId as never);
}

/** Acts as the queue worker: no request, so no user, no tenant and no organization. */
function actAsWorker(): void {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null as never);
	actAs(null, null);
}

async function openFixture(): Promise<IFixture> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [SubscriptionSchema, DeliverySchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const subscriptionRows = dataSource.getRepository(SubscriptionSchema);
	const deliveryRows = dataSource.getRepository(DeliverySchema);
	const publisher = {
		subscriptionDisabled: jest.fn().mockResolvedValue(true),
		deliveryFailed: jest.fn().mockResolvedValue(true)
	};
	const subscriptionService = new WebhookSubscriptionService(
		subscriptionRows as never,
		{} as never,
		new EncryptionService(),
		publisher as never
	);
	const deliveryService = new WebhookDeliveryService(
		deliveryRows as never,
		{} as never,
		subscriptionService,
		publisher as never
	);

	// Each tenant subscribes through the service, so the rows carry what the API writes.
	actAs(TENANT_A, ORG_A1);
	const own = await subscriptionService.createSubscription({
		name: 'A orders',
		url: 'https://a.example.com/hooks',
		events: ['order.placed']
	});
	// A caller of tenant A with no organization selected writes a tenant-wide subscription.
	actAs(TENANT_A, null);
	const tenantWide = await subscriptionService.createSubscription({
		name: 'A tenant-wide',
		url: 'https://a.example.com/tenant-wide',
		events: ['*']
	});
	actAs(TENANT_B, ORG_B1);
	const foreign = await subscriptionService.createSubscription({
		name: 'B orders',
		url: 'https://b.example.com/hooks',
		events: ['order.placed'],
		headers: { Authorization: 'Bearer b-partner-token' }
	});
	jest.restoreAllMocks();

	const ownDelivery = await deliveryRows.save({
		subscriptionId: own.subscription.id,
		eventId: 'e0000000-0000-4000-8000-00000000000a',
		eventName: 'order.placed',
		payload: { data: { orderId: 'a-order' } },
		status: WebhookDeliveryStatus.DEAD,
		attemptCount: 7,
		responseStatus: 500,
		responseBody: 'A partner answer',
		lastError: 'The endpoint answered 500.',
		tenantId: TENANT_A,
		organizationId: ORG_A1
	});
	const foreignDelivery = await deliveryRows.save({
		subscriptionId: foreign.subscription.id,
		eventId: 'e0000000-0000-4000-8000-00000000000b',
		eventName: 'order.placed',
		payload: { data: { orderId: 'b-order', customer: 'b-customer' } },
		status: WebhookDeliveryStatus.DEAD,
		attemptCount: 7,
		responseStatus: 500,
		responseBody: 'B partner answer',
		lastError: 'The endpoint answered 500.',
		tenantId: TENANT_B,
		organizationId: ORG_B1
	});

	const tenantWideDelivery = await deliveryRows.save({
		subscriptionId: tenantWide.subscription.id,
		eventId: 'e0000000-0000-4000-8000-00000000000c',
		eventName: 'tenant.updated',
		payload: { data: {} },
		status: WebhookDeliveryStatus.DELIVERED,
		attemptCount: 1,
		responseStatus: 200,
		responseBody: 'A tenant-wide answer',
		tenantId: TENANT_A,
		organizationId: null
	});

	return {
		dataSource,
		subscriptionRows,
		deliveryRows,
		subscriptionService,
		deliveryService,
		rest: {
			subscriptions: new WebhookSubscriptionController(subscriptionService),
			deliveries: new WebhookDeliveryController(deliveryService)
		},
		graphql: new WebhookResolver(subscriptionService, deliveryService, {} as never),
		ownSubscriptionId: String(own.subscription.id),
		foreignSubscriptionId: String(foreign.subscription.id),
		ownDeliveryId: String(ownDelivery.id),
		foreignDeliveryId: String(foreignDelivery.id),
		tenantWideSubscriptionId: String(tenantWide.subscription.id),
		tenantWideDeliveryId: String(tenantWideDelivery.id)
	};
}

describe('webhook id-addressed operations are scoped to the caller (R1-01, R1-02)', () => {
	let fixture: IFixture;
	/** Tenant B's stored subscription row, as it was before a case ran. */
	let foreignBefore: Record<string, any>;

	beforeEach(async () => {
		fixture = await openFixture();
		foreignBefore = await fixture.subscriptionRows.findOneByOrFail({ id: fixture.foreignSubscriptionId });
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await fixture.dataSource.destroy();
	});

	/** Tenant B's row is exactly what it was: no column moved. */
	async function expectForeignSubscriptionUntouched(): Promise<void> {
		const after = await fixture.subscriptionRows.findOneBy({ id: fixture.foreignSubscriptionId });

		expect(after).toEqual(foreignBefore);
	}

	describe('subscriptions over REST', () => {
		it('GET /:id answers 404 for another tenant’s subscription, and B reads its own (control)', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.subscriptions.findById(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);

			actAs(TENANT_B, ORG_B1);
			const own = await fixture.rest.subscriptions.findById(fixture.foreignSubscriptionId);
			expect(own.url).toBe('https://b.example.com/hooks');
		});

		it('PUT /:id cannot re-point another tenant’s endpoint', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(
				fixture.rest.subscriptions.update(fixture.foreignSubscriptionId, {
					url: 'https://attacker.example.com/h'
				} as never)
			).rejects.toBeInstanceOf(NotFoundException);
			await expectForeignSubscriptionUntouched();

			// Control: the same body on the caller's own row is accepted.
			const own = await fixture.rest.subscriptions.update(fixture.ownSubscriptionId, {
				url: 'https://a.example.com/hooks/v2'
			} as never);
			expect(own.url).toBe('https://a.example.com/hooks/v2');
		});

		it('DELETE /:id cannot remove another tenant’s subscription', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.subscriptions.delete(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expectForeignSubscriptionUntouched();

			// Control: the caller removes its own.
			await fixture.rest.subscriptions.delete(fixture.ownSubscriptionId);
			expect(await fixture.subscriptionRows.findOneBy({ id: fixture.ownSubscriptionId })).toBeNull();
		});

		it('POST /:id/rotate-secret never hands out another tenant’s new secret', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.subscriptions.rotateSecret(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expectForeignSubscriptionUntouched();
		});

		it('POST /:id/enable and /:id/disable cannot switch another tenant’s endpoint', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.subscriptions.disable(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(fixture.rest.subscriptions.enable(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expectForeignSubscriptionUntouched();

			// Control: B switches its own off.
			actAs(TENANT_B, ORG_B1);
			expect((await fixture.rest.subscriptions.disable(fixture.foreignSubscriptionId)).isActive).toBe(false);
		});

		it('another organization of the same tenant is outside the scope too, as it is for the list', async () => {
			actAs(TENANT_A, ORG_A2);
			expect((await fixture.rest.subscriptions.findAll({} as never)).items).toEqual([]);
			await expect(fixture.rest.subscriptions.findById(fixture.ownSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it('a caller with no tenant addresses nothing', async () => {
			actAs(null, null);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-without-tenant' } as never);
			await expect(fixture.rest.subscriptions.findById(fixture.foreignSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	describe('a caller with a tenant but no organization selected', () => {
		it('lists and addresses only the tenant-wide subscriptions, not an organization’s', async () => {
			actAs(TENANT_A, null);

			const listed = (await fixture.rest.subscriptions.findAll({} as never)).items.map((row) => row.id);
			expect(listed).toEqual([fixture.tenantWideSubscriptionId]);
			expect((await fixture.rest.subscriptions.findById(fixture.tenantWideSubscriptionId)).name).toBe(
				'A tenant-wide'
			);
			await expect(fixture.rest.subscriptions.findById(fixture.ownSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(await fixture.graphql.webhookSubscription(fixture.foreignSubscriptionId)).toBeNull();

			// Control: the organization's caller does not see the tenant-wide row either — one set per scope.
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.subscriptions.findById(fixture.tenantWideSubscriptionId)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it('lists and addresses only the tenant-wide deliveries', async () => {
			actAs(TENANT_A, null);

			const listed = (await fixture.rest.deliveries.findAll({} as never)).items.map((row) => row.id);
			expect(listed).toEqual([fixture.tenantWideDeliveryId]);
			expect((await fixture.rest.deliveries.findById(fixture.tenantWideDeliveryId)).responseBody).toBe(
				'A tenant-wide answer'
			);
			await expect(fixture.rest.deliveries.findById(fixture.ownDeliveryId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(fixture.rest.deliveries.redeliver(fixture.foreignDeliveryId)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});
	});

	describe('a caller with no tenant', () => {
		it('lists nothing on either resource, over either protocol', async () => {
			actAs(null, null);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-without-tenant' } as never);

			expect((await fixture.rest.subscriptions.findAll({} as never)).items).toEqual([]);
			expect((await fixture.rest.deliveries.findAll({} as never)).items).toEqual([]);
			expect((await fixture.graphql.webhookSubscriptions()).totalCount).toBe(0);
			expect((await fixture.graphql.webhookDeliveries()).totalCount).toBe(0);
			expect(await fixture.graphql.webhookDelivery(fixture.foreignDeliveryId)).toBeNull();
		});
	});

	describe('subscriptions over GraphQL', () => {
		it('webhookSubscription answers null for another tenant’s id, and the row for its owner (control)', async () => {
			actAs(TENANT_A, ORG_A1);
			expect(await fixture.graphql.webhookSubscription(fixture.foreignSubscriptionId)).toBeNull();

			actAs(TENANT_B, ORG_B1);
			expect((await fixture.graphql.webhookSubscription(fixture.foreignSubscriptionId))?.name).toBe('B orders');
		});

		it('no mutation reaches another tenant’s subscription', async () => {
			actAs(TENANT_A, ORG_A1);
			const id = fixture.foreignSubscriptionId;

			await expect(
				fixture.graphql.updateWebhookSubscription({ id, url: 'https://attacker.example.com/h' } as never)
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(fixture.graphql.rotateWebhookSecret(id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(fixture.graphql.disableWebhookSubscription(id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(fixture.graphql.enableWebhookSubscription(id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(fixture.graphql.deleteWebhookSubscription(id)).rejects.toBeInstanceOf(NotFoundException);

			await expectForeignSubscriptionUntouched();
		});
	});

	describe('deliveries over both protocols', () => {
		it('GET /webhooks/deliveries/:id and webhookDelivery do not read another tenant’s delivery', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.deliveries.findById(fixture.foreignDeliveryId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(await fixture.graphql.webhookDelivery(fixture.foreignDeliveryId)).toBeNull();

			// Control: B reads its own, and A reads its own.
			actAs(TENANT_B, ORG_B1);
			expect((await fixture.rest.deliveries.findById(fixture.foreignDeliveryId)).responseBody).toBe(
				'B partner answer'
			);
			actAs(TENANT_A, ORG_A1);
			expect((await fixture.graphql.webhookDelivery(fixture.ownDeliveryId))?.responseBody).toBe('A partner answer');
		});

		it('redeliver cannot re-fire another tenant’s stored payload, on either protocol', async () => {
			actAs(TENANT_A, ORG_A1);
			await expect(fixture.rest.deliveries.redeliver(fixture.foreignDeliveryId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(fixture.graphql.redeliverWebhook(fixture.foreignDeliveryId)).rejects.toBeInstanceOf(
				NotFoundException
			);

			const foreign = await fixture.deliveryRows.findOneByOrFail({ id: fixture.foreignDeliveryId });
			expect(foreign.status).toBe(WebhookDeliveryStatus.DEAD);
			expect(foreign.attemptCount).toBe(7);

			// Control: the caller requeues its own.
			const own = await fixture.rest.deliveries.redeliver(fixture.ownDeliveryId);
			expect(own.status).toBe(WebhookDeliveryStatus.PENDING);
		});
	});

	describe('the delivery runtime', () => {
		it('still reaches any tenant’s delivery and subscription from the queue worker, where there is no caller', async () => {
			actAsWorker();
			// The HTTP call itself is stubbed at the service's own seam: this case is about which rows the
			// runtime can read, not about the client (that is `webhook-delivery.service.spec.ts`).
			const post = jest
				.spyOn(fixture.deliveryService as never as { post: () => Promise<unknown> }, 'post')
				.mockResolvedValue({ delivered: true, responseStatus: 200, responseBody: 'ok', durationMs: 1 });
			// A public literal address, so the policy has nothing to resolve.
			await fixture.subscriptionRows.update({ id: fixture.foreignSubscriptionId }, { url: 'https://93.184.215.14/h' });

			const attempt = await fixture.deliveryService.deliver(fixture.foreignDeliveryId);

			expect(post).toHaveBeenCalledTimes(1);
			expect(attempt.result.delivered).toBe(true);
			expect(attempt.delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
			const subscription = await fixture.subscriptionRows.findOneByOrFail({ id: fixture.foreignSubscriptionId });
			expect(subscription.lastSuccessAt).toBeTruthy();
		});
	});
});
