import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import { EncryptionService } from '../common/encryption/encryption.service';
import { RequestContext } from '../core/context/request-context';
import { WebhookSubscription } from './webhook-subscription.entity';
import { IWebhookSubscriptionInput, WebhookSubscriptionService } from './webhook-subscription.service';
import { TypeOrmWebhookSubscriptionRepository } from './repository/type-orm-webhook-subscription.repository';

/**
 * Subscriptions, their signing secret and the state the delivery path depends on.
 *
 * Two properties are the point of this suite. The secret is write-only: it is returned once, at the
 * moment it is generated, and every other read hands back a fingerprint — so no case prints or
 * compares a plaintext secret; what they assert is that the stored value *differs* from the
 * plaintext, that the plaintext is not contained in it, and that a digest is what a caller receives.
 * And the endpoint's own state is what eventually switches a dead receiver off: consecutive failures
 * are counted, a `410` disables at once, and the switch and the counter reset together.
 *
 * The table is an in-memory one and the encryption helper is the real one, so "encrypted at rest" is
 * exercised rather than mocked, and the URL checks a case goes through are the shape checks that
 * happen before anything is probed.
 */

type Row = Record<string, any>;

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint "UQ_webhook_subscription_url"'), {
		code: '23505'
	});
}

/** An in-memory stand-in for the `webhook_subscription` table. */
class SubscriptionTable {
	readonly rows: Row[] = [];
	private sequence = 0;

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `subscription-${this.sequence}`, ...input };
	}

	async save(row: Row): Promise<Row> {
		// One subscription per endpoint: a duplicate would double-deliver every matching event.
		const clash = this.rows.find(
			(existing) =>
				existing.id !== row.id &&
				(existing.organizationId ?? null) === (row.organizationId ?? null) &&
				existing.url === row.url
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

	async find(options: { where?: Row } = {}): Promise<Row[]> {
		return this.rows.filter((row) => matches(row, options.where ?? {}));
	}
}

function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => (row[column] ?? null) === (condition ?? null));
}

/** The service under test, with the table it writes to and the platform's encryption helper. */
function subscriptions() {
	const table = new SubscriptionTable();
	const service = new WebhookSubscriptionService(
		table as unknown as TypeOrmWebhookSubscriptionRepository,
		{} as never,
		new EncryptionService(),
		// The publisher is doubled rather than left out: the switch-off is announced from the service,
		// and a suite about the switch is not a suite about the fan-out. What it announces is asserted
		// where the two surfaces are, in `webhook.resolver.spec.ts`.
		{ subscriptionDisabled: jest.fn().mockResolvedValue(true) } as never
	);

	return { service, table };
}

/** The endpoint an operator subscribes, so a case can vary exactly one thing. */
const input = (overrides: Partial<IWebhookSubscriptionInput> = {}): IWebhookSubscriptionInput => ({
	name: 'Order notifications',
	url: 'https://receiver.example.test/hooks/orders',
	events: ['order.placed'],
	...overrides
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('the subscription row', () => {
	it('accepts a row the API would write and refuses one the table contract rejects', () => {
		const row = () =>
			Object.assign(new WebhookSubscription(), {
				name: 'Order notifications',
				url: 'https://receiver.example.test/hooks/orders',
				secret: 'encrypted-at-rest',
				events: ['order.placed'],
				failureCount: 0
			});

		expect(validateSync(row()).map((error) => error.property)).toEqual([]);
		// The endpoint and the event list are validated where they are stored as well as where they are
		// used, so a row cannot be written that the delivery path would then refuse to call.
		expect(validateSync(Object.assign(row(), { url: 'http://' })).map((error) => error.property)).toEqual(['url']);
		expect(validateSync(Object.assign(row(), { events: 'order.placed' })).map((error) => error.property)).toEqual([
			'events'
		]);
	});
});

describe('creating a subscription', () => {
	it('hands the secret back once and never in a projection afterwards', async () => {
		const { service, table } = subscriptions();
		const { subscription, secret } = await service.createSubscription(input());

		expect(subscription).not.toHaveProperty('secret');
		// Only a digest is exposed: enough to tell two subscriptions apart, useless for signing, and
		// nothing in it carries the plaintext.
		expect(subscription.secretFingerprint).toMatch(/^[0-9a-f]{8}$/);
		expect(String(subscription.secretFingerprint).includes(secret)).toBe(false);

		const other = await service.createSubscription(input({ url: 'https://other.example.test/hooks' }));

		expect(other.subscription.secretFingerprint === subscription.secretFingerprint).toBe(false);

		// Encrypted at rest: the stored column is neither the plaintext nor a container for it, and the
		// only way back to the plaintext is the decryption the delivery runtime performs.
		expect(table.rows[0].secret === secret).toBe(false);
		expect(String(table.rows[0].secret).includes(secret)).toBe(false);
		expect((await service.revealSecret(table.rows[0].id)) === secret).toBe(true);

		const [listed] = await service.listSubscriptions();

		expect(listed).not.toHaveProperty('secret');
		expect(listed.secretFingerprint).toBe(subscription.secretFingerprint);
	});

	it('refuses an event list that could never deliver anything', async () => {
		const { service, table } = subscriptions();

		await expect(service.createSubscription(input({ events: [] }))).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.createSubscription(input({ events: ['  '] }))).rejects.toBeInstanceOf(BadRequestException);
		expect(table.rows).toHaveLength(0);
	});

	it('refuses an endpoint the platform must not call in cleartext', async () => {
		const { service } = subscriptions();

		await expect(service.createSubscription(input({ url: 'not-a-url' }))).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.createSubscription(input({ url: 'http://receiver.example.test/hooks' }))).rejects.toBeInstanceOf(
			BadRequestException
		);

		// Control: the documented development escape works, so the refusal above is about TLS rather than
		// about the endpoint being unusable at all.
		await expect(
			service.createSubscription(input({ url: 'http://receiver.example.test/hooks', metadata: { allowInsecure: true } }))
		).resolves.toBeDefined();
	});

	it('refuses the insecure escape outright when the platform runs in production', async () => {
		const { service } = subscriptions();
		const previous = process.env.NODE_ENV;

		process.env.NODE_ENV = 'production';

		try {
			await expect(
				service.createSubscription(input({ url: 'http://receiver.example.test/hooks', metadata: { allowInsecure: true } }))
			).rejects.toBeInstanceOf(BadRequestException);
		} finally {
			process.env.NODE_ENV = previous;
		}
	});

	it('refuses a second subscription for one endpoint in the same organization', async () => {
		const { service, table } = subscriptions();

		await service.createSubscription(input());

		await expect(service.createSubscription(input())).rejects.toBeInstanceOf(ConflictException);
		expect(table.rows).toHaveLength(1);
	});

	it('defaults the pinned payload version and the failure counter, and stamps the caller’s tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		const { service, table } = subscriptions();
		const { subscription } = await service.createSubscription(input());

		expect(subscription).toMatchObject({ apiVersion: '1', failureCount: 0 });
		expect(subscription.lastSuccessAt).toBeUndefined();
		expect(table.rows[0]).toMatchObject({ tenantId: 'tenant-1', organizationId: 'org-1' });
	});
});

describe('rotating the signing secret', () => {
	it('keeps the previous secret valid for the grace window and drops it after', async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date('2026-03-01T10:00:00Z'));

		const { service } = subscriptions();
		const created = await service.createSubscription(input());
		const stored = await service.getSubscription(created.subscription.id as string);

		const rotated = await service.rotateSecret(created.subscription.id as string);

		// The endpoint still holds the old secret, so it stays valid for a window: that is what makes a
		// rotation possible without losing deliveries.
		expect(rotated.subscription).not.toHaveProperty('secret');
		expect(service.previousSecretOf(stored) === created.secret).toBe(true);
		expect(rotated.secret === created.secret).toBe(false);
		expect(service.previousSecretOf(stored) === rotated.secret).toBe(false);

		jest.setSystemTime(new Date(new Date('2026-03-01T10:00:00Z').getTime() + WebhookSubscriptionService.SECRET_ROTATION_GRACE_MS));

		expect(service.previousSecretOf(stored)).toBeUndefined();
	});

	it('refuses to rotate a subscription that does not exist', async () => {
		const { service } = subscriptions();

		await expect(service.rotateSecret('subscription-404')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('the endpoint’s own state', () => {
	it('resets the failure counter on a success and stamps both kinds of attempt', async () => {
		const { service } = subscriptions();
		const created = await service.createSubscription(input());
		const id = created.subscription.id as string;

		await service.recordAttempt(id, { delivered: false, status: 500 });
		const afterFailure = await service.recordAttempt(id, { delivered: false, status: 500 });

		expect(afterFailure.failureCount).toBe(2);
		expect(afterFailure.lastFailureAt).toBeInstanceOf(Date);

		const afterSuccess = await service.recordAttempt(id, { delivered: true, status: 200 });

		// The counter is "consecutive failures", which is what makes it a usable signal.
		expect(afterSuccess.failureCount).toBe(0);
		expect(afterSuccess.lastSuccessAt).toBeInstanceOf(Date);
	});

	it('disables the endpoint once the documented number of failures is reached, and not before', async () => {
		const { service, table } = subscriptions();
		const created = await service.createSubscription(input());
		const id = created.subscription.id as string;
		const threshold = WebhookSubscriptionService.AUTO_DISABLE_FAILURE_COUNT;

		expect(threshold).toBe(100);

		table.rows[0].failureCount = threshold - 2;

		const before = await service.recordAttempt(id, { delivered: false, status: 503 });

		// Control: an endpoint one failure short of the threshold is still being called.
		expect(before.failureCount).toBe(threshold - 1);
		expect(before.disabledAt).toBeFalsy();

		const atThreshold = await service.recordAttempt(id, { delivered: false, status: 503 });

		expect(atThreshold.failureCount).toBe(threshold);
		expect(atThreshold.isActive).toBe(false);
		expect(atThreshold.disabledAt).toBeInstanceOf(Date);
	});

	it('disables an endpoint that answers 410 at once, because retrying it is pointless', async () => {
		const { service } = subscriptions();
		const created = await service.createSubscription(input());

		const attempt = await service.recordAttempt(created.subscription.id as string, { delivered: false, status: 410 });

		expect(attempt.isActive).toBe(false);
		expect(attempt.failureCount).toBe(1);
	});

	it('switches an endpoint back on and resets the counter with it', async () => {
		const { service, table } = subscriptions();
		const created = await service.createSubscription(input());
		const id = created.subscription.id as string;

		await service.recordAttempt(id, { delivered: false, status: 410 });
		const enabled = await service.enable(id);

		// Keeping the counter would disable the subscription again on its first hiccup.
		expect(enabled).toMatchObject({ isActive: true, failureCount: 0 });
		expect(table.rows[0].disabledAt).toBeNull();

		const disabled = await service.disable(id, 'the receiver asked us to stop');

		expect(disabled.isActive).toBe(false);
		expect(disabled.metadata).toMatchObject({ disabledReason: 'the receiver asked us to stop' });
	});
});

describe('the event selection a subscription declares', () => {
	it('reads an exact name, one segment under an aggregate, and the whole catalogue', () => {
		const matches = WebhookSubscriptionService.matchesPattern;

		expect(matches('order.placed', 'order.placed')).toBe(true);
		expect(matches('order.placed', 'order.confirmed')).toBe(false);
		expect(matches('order.*', 'order.placed')).toBe(true);
		// `order.*` matches exactly one more segment, which is what keeps it from becoming an accidental
		// catch-all over an aggregate's nested lifecycle facets.
		expect(matches('order.*', 'order.payment.captured')).toBe(false);
		expect(matches('*', 'order.placed')).toBe(true);
		expect(matches('*', 'order.payment.captured')).toBe(true);
		expect(matches('*.payment.*', 'order.payment.captured')).toBe(true);
		expect(matches('*.payment.*', 'payment.captured')).toBe(false);
	});

	it('never selects an event from an empty pattern list', () => {
		expect(WebhookSubscriptionService.matchesEvent([], 'order.placed')).toBe(false);
		expect(WebhookSubscriptionService.matchesEvent(undefined, 'order.placed')).toBe(false);
		expect(WebhookSubscriptionService.matchesEvent(['order.*'], 'order.placed')).toBe(true);
	});

	it('selects only the active subscriptions of the caller’s tenant and channel', async () => {
		const { service, table } = subscriptions();

		table.rows.push(
			table.create({
				name: 'Mine',
				url: 'https://mine.example.test/hooks',
				events: ['order.*'],
				isActive: true,
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			}),
			table.create({
				name: 'Foreign',
				url: 'https://foreign.example.test/hooks',
				events: ['order.*'],
				isActive: true,
				tenantId: 'tenant-2',
				organizationId: 'org-1'
			}),
			table.create({
				name: 'Disabled',
				url: 'https://disabled.example.test/hooks',
				events: ['order.*'],
				isActive: true,
				disabledAt: new Date('2026-03-01T10:00:00Z'),
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			}),
			table.create({
				name: 'Other channel',
				url: 'https://channel.example.test/hooks',
				events: ['order.*'],
				isActive: true,
				channelId: 'channel-2',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			})
		);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		// Control: a match that ignored the tenant would deliver one tenant's orders to another's
		// endpoint, and a disabled subscription is never selected — the operator switched it off.
		expect((await service.findMatching('order.placed', 'channel-1')).map((row) => row.name)).toEqual(['Mine']);
		expect((await service.findMatching('order.placed', 'channel-2')).map((row) => row.name)).toEqual([
			'Mine',
			'Other channel'
		]);
		expect(await service.findMatching('invoice.issued', 'channel-1')).toEqual([]);
	});

	it('keeps the listing of an organization to its own tenant', async () => {
		const { service } = subscriptions();

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		await service.createSubscription(input());

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-2');

		expect(await service.listSubscriptions()).toEqual([]);
	});
});
