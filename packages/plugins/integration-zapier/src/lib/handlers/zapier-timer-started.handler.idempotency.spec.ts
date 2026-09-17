import { delay, of, switchMap, throwError, timer } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ITimeLog } from '@gauzy/contracts';
import { TimerStartedEvent } from '@gauzy/core';
import { ZapierTimerStartedHandler } from './zapier-timer-started.handler';
import { ZapierWebhookService } from '../zapier-webhook.service';
import { TypeOrmZapierWebhookSubscriptionRepository } from '../repository/type-orm-zapier-webhook-subscription.repository';

/**
 * TASK 4 (background job idempotency) — a third example alongside `@gauzy/core`'s
 * `token-cleanup.idempotency.spec.ts` (positive control) and
 * `employee-notification.idempotency.spec.ts` (a found-and-fixed gap). This one is the
 * highest-value finding from that investigation: duplicate delivery to an EXTERNAL system, not
 * just an internal DB row.
 *
 * `ZapierTimerStartedHandler` is an in-process `@nestjs/cqrs` `IEventHandler` for `TimerStartedEvent`
 * (published from `packages/core/src/lib/time-tracking/timer/commands/handlers/start-timer.handler.ts`),
 * so it needs no real queue/Redis to test. `ZapierWebhookService.notifyTimerStatusChanged` had NO
 * idempotency key, delivery id, or "already notified for this timeLog" guard: a redelivered/replayed
 * event (a duplicate `eventBus.publish()`, a CQRS-level retry, or this handler moving onto a real
 * retryable queue later) sent every matching Zapier/Make.com subscriber a duplicate outbound
 * webhook — visible to, and potentially acted on twice by, a third party outside this codebase's
 * control. Fixed in `ZapierWebhookService.notifyTimerStatusChanged` with a per-process delivery-dedup
 * cache keyed on `(subscription.id, action, timeLog.id)`.
 *
 * The identically-shaped `integration-make-com` and `integration-sim` timer handlers have the same
 * gap and are not fixed here — see this package's follow-up note.
 */
describe('ZapierTimerStartedHandler idempotency', () => {
	// A generic, non-Zapier-specific target: `hooks.zapier.com/hooks/catch/<id>/<token>` matches
	// GitGuardian's "Zapier Webhook URL" detector by URL SHAPE alone, regardless of whether the
	// digits are real — flagged (as a false positive) on this file precisely because of that
	// pattern. `example.com` (RFC 2606, reserved for documentation/examples) still satisfies
	// `assertSafeZapierWebhookUrl` (a real, public, non-loopback HTTPS host) without looking like a
	// live credential to a scanner.
	function buildService(postResult: unknown = { data: {}, status: 200 }, subscriptionCount = 1) {
		const subscriptions = Array.from({ length: subscriptionCount }, (_, i) => ({
			id: `subscription-${i + 1}`,
			targetUrl: 'https://example.com/webhook-test',
			event: 'timer.status.changed',
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		}));
		const repository = {
			find: jest.fn().mockResolvedValue(subscriptions)
		} as unknown as TypeOrmZapierWebhookSubscriptionRepository;

		const post = jest.fn().mockReturnValue(of(postResult));
		const httpService = { post } as unknown as HttpService;

		return { service: new ZapierWebhookService(repository, httpService), post };
	}

	it('does not resend a webhook for a redelivered TimerStartedEvent', async () => {
		const { service, post } = buildService();
		const handler = new ZapierTimerStartedHandler(service);

		const timeLog = { id: 'time-log-1', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog;
		const event = new TimerStartedEvent(timeLog);

		await handler.handle(event); // original delivery
		await handler.handle(event); // simulates event redelivery / a duplicate publish

		expect(post).toHaveBeenCalledTimes(1);
	});

	it('still delivers for a DIFFERENT timeLog (not over-deduped)', async () => {
		const { service, post } = buildService();
		const handler = new ZapierTimerStartedHandler(service);

		await handler.handle(
			new TimerStartedEvent({
				id: 'time-log-1',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			} as unknown as ITimeLog)
		);
		await handler.handle(
			new TimerStartedEvent({
				id: 'time-log-2',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			} as unknown as ITimeLog)
		);

		expect(post).toHaveBeenCalledTimes(2);
	});

	it('does NOT suppress a retry after a failed delivery (only a CONFIRMED delivery is deduped)', async () => {
		// The dedup guard must only remember a delivery that actually succeeded — a failed attempt
		// (network error, subscriber 5xx) has to stay free to retry, exactly like a message a queue
		// would legitimately redeliver. If `markDelivered()` were ever called before/regardless of
		// the outcome, this would incorrectly drop the retry on the floor.
		const { service, post } = buildService();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(post as jest.Mock).mockReturnValueOnce(throwError(() => new Error('ECONNREFUSED')) as any);
		const handler = new ZapierTimerStartedHandler(service);
		const timeLog = { id: 'time-log-1', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog;

		await handler.handle(new TimerStartedEvent(timeLog)); // fails
		await handler.handle(new TimerStartedEvent(timeLog)); // retry must still go out

		expect(post).toHaveBeenCalledTimes(2);
	});

	it('does not double-send when two redeliveries race CONCURRENTLY, not just sequentially', async () => {
		// The other tests `await` each `handle()` in turn, so the first call's dedup entry is always
		// already written before the second starts — real review finding on this PR: that never
		// exercises the actual race (two redeliveries in flight at once, neither confirmed yet). A
		// deliberate delay on the mocked POST keeps both calls "in flight" simultaneously past the
		// point where the (synchronous, no-`await`-in-between) check-and-reserve step runs.
		const { service, post } = buildService();
		(post as jest.Mock).mockReturnValue(of({ data: {}, status: 200 }).pipe(delay(5)));
		const handler = new ZapierTimerStartedHandler(service);
		const timeLog = { id: 'time-log-1', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog;

		await Promise.all([
			handler.handle(new TimerStartedEvent(timeLog)),
			handler.handle(new TimerStartedEvent(timeLog))
		]);

		expect(post).toHaveBeenCalledTimes(1);
	});

	it('still delivers a concurrent redelivery when the attempt already in flight FAILS', async () => {
		// The concurrent duplicate must wait for the in-flight attempt rather than be dropped: if it
		// were dropped and that attempt then failed, neither call would deliver (review finding on
		// this PR). The first POST fails after a delay, so the second call is waiting on it.
		const { service, post } = buildService();
		(post as jest.Mock).mockReturnValueOnce(
			timer(5).pipe(switchMap(() => throwError(() => new Error('ECONNREFUSED'))))
		);
		const handler = new ZapierTimerStartedHandler(service);
		const timeLog = { id: 'time-log-1', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog;

		await Promise.all([
			handler.handle(new TimerStartedEvent(timeLog)),
			handler.handle(new TimerStartedEvent(timeLog))
		]);
		expect(post).toHaveBeenCalledTimes(2); // the failed attempt, then the waiting redelivery

		await handler.handle(new TimerStartedEvent(timeLog)); // that one succeeded, so this is deduped
		expect(post).toHaveBeenCalledTimes(2);
	});

	it('never dedups an event that carries no timeLog id', async () => {
		// Without a source id a redelivery cannot be told apart from a different event, so each one
		// must go out rather than share one key per subscriber and action.
		const { service, post } = buildService();
		const handler = new ZapierTimerStartedHandler(service);
		const timeLog = { tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog;

		await handler.handle(new TimerStartedEvent(timeLog));
		await handler.handle(new TimerStartedEvent(timeLog));

		expect(post).toHaveBeenCalledTimes(2);
	});

	describe('delivery dedup cache bounds', () => {
		// Mirrors `WEBHOOK_DELIVERY_DEDUP_MAX_ENTRIES` in zapier-webhook.service.ts.
		const MAX_ENTRIES = 10000;
		const LIVE_MS = 60 * 1000;

		// The cache is private; prefilling it directly stands in for thousands of earlier deliveries.
		const cacheOf = (service: ZapierWebhookService) =>
			(service as unknown as { recentlyDelivered: Map<string, number> }).recentlyDelivered;
		const timeLogWithId = (id: string) =>
			({ id, tenantId: 'tenant-1', organizationId: 'org-1' }) as unknown as ITimeLog;

		// Hundreds of skipped deliveries would otherwise each print a debug line.
		let debugSpy: jest.SpyInstance;
		beforeEach(() => {
			debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		});
		afterEach(() => debugSpy.mockRestore());

		it('never exceeds the cap, evicts oldest first, still skips a redelivery of the latest event', async () => {
			// Security finding on this PR: the cache had no cap and every lookup scanned all of it, once
			// per subscription per timer event, so one tenant could block the shared event loop.
			const subscriptionCount = 200;
			const events = 30;
			const { service, post } = buildService(undefined, subscriptionCount);
			const cache = cacheOf(service);
			const now = Date.now();
			for (let i = 0; i < 5000; i++) {
				cache.set(`expired-${i}`, now - 1);
			}
			for (let i = 0; i < MAX_ENTRIES; i++) {
				cache.set(`live-${i}`, now + LIVE_MS);
			}
			const handler = new ZapierTimerStartedHandler(service);

			for (let n = 1; n <= events; n++) {
				await handler.handle(new TimerStartedEvent(timeLogWithId(`time-log-${n}`)));
				expect(cache.size).toBeLessThanOrEqual(MAX_ENTRIES);
			}

			const delivered = events * subscriptionCount; // 6,000 new keys, all delivered
			expect(post).toHaveBeenCalledTimes(delivered);
			expect(cache.size).toBe(MAX_ENTRIES);
			expect(cache.has('expired-4999')).toBe(false); // expired head entries were pruned
			expect(cache.has(`live-${delivered - 1}`)).toBe(false); // the oldest live keys made room...
			expect(cache.has(`live-${delivered}`)).toBe(true); // ...and no more than needed
			expect(cache.has(`subscription-1:start:time-log-${events}`)).toBe(true);

			await handler.handle(new TimerStartedEvent(timeLogWithId(`time-log-${events}`)));
			expect(post).toHaveBeenCalledTimes(delivered); // the redelivery is still skipped

			await handler.handle(new TimerStartedEvent(timeLogWithId(`time-log-${events + 1}`)));
			expect(post).toHaveBeenCalledTimes(delivered + subscriptionCount); // a new event still goes out
			expect(cache.size).toBe(MAX_ENTRIES);
		});

		it('does not let an expired key behind a live one suppress a delivery', async () => {
			// Pruning stops at the first live entry, so an expired key can remain behind it; the lookup
			// has to check expiry itself.
			const { service, post } = buildService();
			const cache = cacheOf(service);
			const key = 'subscription-1:start:time-log-1';
			const now = Date.now();
			cache.set('live-head', now + LIVE_MS);
			cache.set(key, now - 1);
			cache.set('stale-behind-live', now - 1);
			const handler = new ZapierTimerStartedHandler(service);

			await handler.handle(new TimerStartedEvent(timeLogWithId('time-log-1')));
			expect(post).toHaveBeenCalledTimes(1); // the expired key did not suppress it

			// Pruning stopped at the live head instead of scanning the whole Map, and the re-marked key
			// moved to the end, so insertion order is still expiry order.
			expect(cache.has('stale-behind-live')).toBe(true);
			expect([...cache.keys()].pop()).toBe(key);

			await handler.handle(new TimerStartedEvent(timeLogWithId('time-log-1')));
			expect(post).toHaveBeenCalledTimes(1); // now live again, so the redelivery is skipped
		});
	});
});
