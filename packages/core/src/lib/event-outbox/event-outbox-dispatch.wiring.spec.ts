import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerQueueService } from '@gauzy/scheduler';
import { GRAPHQL_PUBSUB_ENGINE, GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { EVENT_OUTBOX_APPEND_DEBOUNCE_MS, EVENT_OUTBOX_QUEUE_NAME } from './event-outbox-constant';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxAppendSignal } from './event-outbox-append.signal';
import { EventOutboxInlineDispatch, EventOutboxQueueDispatchTrigger } from './event-outbox-dispatch.trigger';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';
import { EventOutboxService } from './event-outbox.service';

/**
 * The pieces as Nest builds them: the injector resolves each constructor from its emitted metadata, runs the
 * lifecycle hooks that register the listener, and hands an optional engine that is switched off as `null`. A unit
 * test that calls `new` on each class would pass with any of those broken, and the API would not boot.
 */
describe('prompt outbox delivery, wired by Nest', () => {
	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('without a queue: an append starts an in-process drain', async () => {
		const claimBatch = jest.fn(async () => []);
		const moduleRef = await Test.createTestingModule({
			providers: [
				EventOutboxAppendSignal,
				{ provide: EventOutboxService, useValue: { claimBatch } },
				{ provide: EventConsumerRegistry, useValue: { consumersFor: () => [] } },
				EventOutboxDispatcher,
				EventOutboxInlineDispatch
			]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();

		const signal = app.get(EventOutboxAppendSignal);
		expect(signal.deliveryMode()).toBe('inline');

		signal.notify();
		await new Promise((resolve) => setTimeout(resolve, EVENT_OUTBOX_APPEND_DEBOUNCE_MS + 50));

		expect(claimBatch).toHaveBeenCalled();
		await app.close();
		// Closed: nothing listens any more.
		expect(signal.deliveryMode()).toBe('none');
	});

	it('with a queue: an append enqueues a draining pass on the outbox queue', async () => {
		const enqueue = jest.fn(async () => undefined);
		const moduleRef = await Test.createTestingModule({
			providers: [
				EventOutboxAppendSignal,
				{ provide: SchedulerQueueService, useValue: { enqueue } },
				EventOutboxQueueDispatchTrigger
			]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();

		app.get(EventOutboxAppendSignal).notify();
		await new Promise((resolve) => setTimeout(resolve, EVENT_OUTBOX_APPEND_DEBOUNCE_MS + 50));

		expect(enqueue).toHaveBeenCalledWith(
			expect.objectContaining({
				queueName: EVENT_OUTBOX_QUEUE_NAME,
				data: expect.objectContaining({ drain: true })
			})
		);
		await app.close();
	});

	it('takes an engine that is switched off (null) as the in-process broker', async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [{ provide: GRAPHQL_PUBSUB_ENGINE, useFactory: () => null }, GraphqlPubSub]
		}).compile();
		const pubSub = moduleRef.get(GraphqlPubSub);

		const stream = pubSub.asyncIterableIterator<{ id: string }>(pubSub.topicFor('chat_message.created', 't1'));
		await pubSub.publish('chat_message.created', 't1', { id: 'm1' });

		expect(pubSub.sharedAcrossProcesses).toBe(false);
		expect((await stream.next()).value).toEqual({ id: 'm1' });
		await moduleRef.close();
	});
});
