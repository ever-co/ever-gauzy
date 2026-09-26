/**
 * The outbound delivery retry pass: the schedule that asks for it and the worker that runs it.
 *
 * `WebhookDeliveryService` writes a seven-rung ladder onto every delivery and records the instant of
 * the next attempt after each refusal, and `findDue` reads exactly the rows whose instant has passed.
 * **Nothing called it.** So the second attempt never happened: an endpoint that was unreachable for
 * the one moment a fan-out reached it never heard about that event again, and the operator's own
 * redelivery through `requeue` only moved a row back to `PENDING` for a job that did not exist. Every
 * individual piece worked, which is why nothing reported it.
 *
 * This pair is what makes the ladder real, and the suite pins the four things neither half may get
 * wrong:
 *
 * - **the pass is bounded and the bound is the kernel's own constant**, because one endpoint's outage
 *   leaves every delivery to it due at once;
 * - **one row's failure never stops the batch**, so an unreachable endpoint cannot hold up every other
 *   tenant's deliveries;
 * - **a pass that could not read at all is raised, not swallowed**, so the queue's retry and
 *   dead-letter handling sees it — a worker that caught its own failure would report an empty outbound
 *   queue while deliveries aged;
 * - **the schedule names the queue and the queue job the worker consumes**, and the worker answers that
 *   job by that name. A schedule that enqueues a name no worker declares is a job that never runs, and
 *   nothing reports it: the schedule fires on time and the queue accepts the job.
 *
 * The service is doubled and the queue is not stood up, so the worker is the only thing under test.
 */

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 * The worker's constructor reaches `WebhookDeliveryService`, which reaches the crud layer.
 */
import '../core/entities/internal';

import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import { WEBHOOK_QUEUE_NAME, WEBHOOK_RETRY_BATCH_SIZE, WEBHOOK_RETRY_JOB, WEBHOOK_RETRY_SCHEDULE } from './webhook-constant';
import { WebhookRetryScheduler } from './webhook-retry.scheduler';
import { WebhookRetryWorker } from './webhook-retry.worker';
import type { IWebhookRetryJob } from './webhook-retry.worker';
import type { WebhookDeliveryService } from './webhook-delivery.service';

/**
 * The metadata keys the declarations under test are written under.
 *
 * They live in the scheduler package's own `constants/scheduler.constants.ts`, which its barrel does
 * not re-export, so they are stated as text here. Reading the metadata rather than the decorator's
 * arguments is the point — the decorator is applied at load and only what it wrote is what a discovery
 * pass would read — and a wrong key surfaces as `undefined` at the assertion rather than as a pass.
 */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';

/** The key `@nestjs/bullmq`'s `Processor` — which the scheduler's `QueueWorker` is — writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

let log: jest.SpyInstance;
let failure: jest.SpyInstance;

beforeEach(() => {
	log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	failure = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** The lines the worker logged, in the order it logged them. */
function logged(): string[] {
	return log.mock.calls.map((call) => String(call[0]));
}

/** The queued request, named as the kernel names it. */
function queued(requestedAt = '2026-03-01T10:00:00.000Z'): Job<IWebhookRetryJob> {
	return { name: WEBHOOK_RETRY_JOB, data: { requestedAt } } as Job<IWebhookRetryJob>;
}

/** The worker over a scripted service. */
function pass(findDue: jest.Mock, deliver: jest.Mock = jest.fn().mockResolvedValue({})) {
	const webhookDeliveryService = { findDue, deliver };

	return {
		findDue,
		deliver,
		worker: new WebhookRetryWorker(webhookDeliveryService as unknown as WebhookDeliveryService)
	};
}

/** The schedule's own declaration, as the discovery pass reads it. */
function scheduleOf(handler: string) {
	const declared = WebhookRetryScheduler.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(SCHEDULED_JOB_METADATA, declared[handler]);
}

describe('WebhookRetryWorker — one bounded pass', () => {
	it('asks the service for one batch, bounded by the size the kernel declares', async () => {
		const { worker, findDue } = pass(jest.fn().mockResolvedValue([]));

		await worker.handleRetry(queued());

		expect(findDue).toHaveBeenCalledWith(WEBHOOK_RETRY_BATCH_SIZE);
		// Control: the bound is stated rather than left to the service's own default, because the two
		// are different numbers and a pass that stated nothing would take the service's.
		expect(findDue.mock.calls[0]).toHaveLength(1);
	});

	it('attempts every due delivery, one after another, through the service that owns the outcome', async () => {
		const { worker, deliver } = pass(
			jest.fn().mockResolvedValue([{ id: 'delivery-1' }, { id: 'delivery-2' }, { id: 'delivery-3' }])
		);

		await worker.handleRetry(queued());

		// The worker's whole job: the ladder, the attempt, the outcome and the dead-lettering all belong
		// to the service, and the id is the only thing this pass decides to hand it.
		expect(deliver.mock.calls.map((call) => call[0])).toEqual(['delivery-1', 'delivery-2', 'delivery-3']);
		expect(logged()).toContain('Attempted 3 of 3 due webhook delivery(ies)');
	});

	it('does not stop the batch when one attempt cannot be written', async () => {
		const deliver = jest
			.fn()
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
			.mockResolvedValueOnce({});
		const { worker } = pass(
			jest.fn().mockResolvedValue([{ id: 'delivery-1' }, { id: 'delivery-2' }, { id: 'delivery-3' }]),
			deliver
		);

		await worker.handleRetry(queued());

		// `deliver` records a refusal rather than raising, so a rejection here is a failure to *write*
		// the attempt. That row keeps the instant it already had and the next pass meets it again —
		// and the two rows behind it must not pay for it.
		expect(deliver).toHaveBeenCalledTimes(3);
		expect(logged()).toContain('Attempted 2 of 3 due webhook delivery(ies)');
		expect(failure).toHaveBeenCalled();
	});

	it('reports an empty pass as the ordinary state it is', async () => {
		const { worker, deliver } = pass(jest.fn().mockResolvedValue([]));

		await worker.handleRetry(queued());

		// Control: nothing outstanding is what an outbound surface should usually look like, so it is
		// logged and not raised — and nothing is attempted.
		expect(deliver).not.toHaveBeenCalled();
		expect(logged()).toContain('No webhook delivery was due');
		expect(failure).not.toHaveBeenCalled();
	});

	it('raises a pass that could not read the due rows rather than reporting an empty one', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const { worker } = pass(jest.fn().mockRejectedValue(refusal));

		const error = await worker.handleRetry(queued()).catch((thrown) => thrown);

		// The rejection is the store's own error rather than a message wrapped around it, and it reaches
		// the queue so its retry and dead-letter handling can act. A worker that caught this would report
		// an empty outbound queue while every delivery in it aged.
		expect(error).toBe(refusal);
		expect(logged().join('\n')).not.toContain('Attempted');
		expect(failure).toHaveBeenCalled();
	});

	it('lets the failure reach the queue through the worker’s own dispatch', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const { worker } = pass(jest.fn().mockRejectedValue(refusal));

		await expect(worker.process(queued())).rejects.toBe(refusal);
	});
});

describe('WebhookRetryWorker — the job name it answers is the schedule’s', () => {
	it('declares the queue and the queue job the worker consumes, as the kernel’s constants state them', () => {
		// Read against the imported constants rather than against a copy of the same text, because a
		// drifted name is a job that never runs with nothing red anywhere.
		expect(scheduleOf('enqueueRetry')).toMatchObject({
			name: WEBHOOK_RETRY_SCHEDULE,
			queueName: WEBHOOK_QUEUE_NAME,
			queueJobName: WEBHOOK_RETRY_JOB,
			preventOverlap: true
		});
	});

	it('fires often enough for the ladder’s own first rungs to mean anything', () => {
		// Five seconds and thirty seconds are the first two rungs the delivery service writes. A pass
		// that ran hourly would make both of them fiction.
		expect(scheduleOf('enqueueRetry')).toMatchObject({ cron: CronExpression.EVERY_MINUTE });
	});

	it('declares that job name on the handler that runs the pass', () => {
		expect(
			Reflect.getMetadata(
				QUEUE_JOB_HANDLER_METADATA,
				(WebhookRetryWorker.prototype as unknown as Record<string, object>)['handleRetry']
			)
		).toBe(WEBHOOK_RETRY_JOB);
	});

	it('consumes the queue the schedule enqueues onto', () => {
		expect(Reflect.getMetadata(PROCESSOR_METADATA, WebhookRetryWorker)).toMatchObject({
			name: WEBHOOK_QUEUE_NAME
		});
	});
});
