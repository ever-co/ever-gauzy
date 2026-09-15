import { delay, of, throwError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
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
	function buildService(postResult: unknown = { data: {}, status: 200 }) {
		const subscription = {
			id: 'subscription-1',
			targetUrl: 'https://example.com/webhook-test',
			event: 'timer.status.changed',
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		};
		const repository = {
			find: jest.fn().mockResolvedValue([subscription])
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
			new TimerStartedEvent({ id: 'time-log-1', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog)
		);
		await handler.handle(
			new TimerStartedEvent({ id: 'time-log-2', tenantId: 'tenant-1', organizationId: 'org-1' } as unknown as ITimeLog)
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
});
