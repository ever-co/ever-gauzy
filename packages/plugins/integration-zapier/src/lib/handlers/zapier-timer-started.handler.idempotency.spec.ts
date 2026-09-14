import { of } from 'rxjs';
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
	function buildService() {
		const subscription = {
			id: 'subscription-1',
			targetUrl: 'https://hooks.zapier.com/hooks/catch/12345/abcdef',
			event: 'timer.status.changed',
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		};
		const repository = {
			find: jest.fn().mockResolvedValue([subscription])
		} as unknown as TypeOrmZapierWebhookSubscriptionRepository;

		const post = jest.fn().mockReturnValue(of({ data: {}, status: 200 }));
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
});
