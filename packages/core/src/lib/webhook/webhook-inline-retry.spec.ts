import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WEBHOOK_INLINE_RETRY_MS, WebhookInlineRetrySweep } from './webhook-inline-retry';
import { WebhookRetryWorker } from './webhook-retry.worker';

/**
 * An API without a queue now sends each webhook's first attempt (the outbox runs in-process there). A failed attempt
 * goes onto the delivery's retry ladder, which only the retry worker reads, and with no queue nothing asked it: an
 * endpoint that was briefly down never heard about that event again. The sweep asks it every minute.
 */
describe('WebhookInlineRetrySweep', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	/** Lets a finished pass's promise chain run to the end. */
	async function settle(): Promise<void> {
		for (let i = 0; i < 10; i += 1) await Promise.resolve();
	}

	async function sweepOver(handleRetry: jest.Mock) {
		const moduleRef = await Test.createTestingModule({
			providers: [{ provide: WebhookRetryWorker, useValue: { handleRetry } }, WebhookInlineRetrySweep]
		}).compile();
		const app = moduleRef.createNestApplication({ logger: false });
		await app.init();
		return app;
	}

	it('asks the retry worker for a pass every minute, as the queue schedule does', async () => {
		const handleRetry = jest.fn(async (_job: unknown) => undefined);
		const app = await sweepOver(handleRetry);

		expect(handleRetry).not.toHaveBeenCalled();
		jest.advanceTimersByTime(WEBHOOK_INLINE_RETRY_MS);
		expect(handleRetry).toHaveBeenCalledTimes(1);
		expect(handleRetry.mock.calls[0][0]).toMatchObject({ data: { requestedAt: expect.any(String) } });
		await settle();

		jest.advanceTimersByTime(WEBHOOK_INLINE_RETRY_MS);
		expect(handleRetry).toHaveBeenCalledTimes(2);
		await settle();

		await app.close();
		jest.advanceTimersByTime(WEBHOOK_INLINE_RETRY_MS * 3);
		expect(handleRetry).toHaveBeenCalledTimes(2);
	});

	it('runs one pass at a time, and keeps going after a pass fails', async () => {
		let finish!: () => void;
		const handleRetry = jest
			.fn()
			.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
			.mockRejectedValueOnce(new Error('Could not read the due deliveries'))
			.mockResolvedValue(undefined);
		const app = await sweepOver(handleRetry);
		const sweep = app.get(WebhookInlineRetrySweep);

		jest.advanceTimersByTime(WEBHOOK_INLINE_RETRY_MS);
		jest.advanceTimersByTime(WEBHOOK_INLINE_RETRY_MS);
		// The first pass is still running: the second tick joined it.
		expect(handleRetry).toHaveBeenCalledTimes(1);

		finish();
		// Joins the first pass and waits for it.
		await sweep.retry();
		expect(handleRetry).toHaveBeenCalledTimes(1);
		// The second pass fails; the sweep logs it and stays usable.
		await sweep.retry();
		expect(handleRetry).toHaveBeenCalledTimes(2);
		await sweep.retry();
		expect(handleRetry).toHaveBeenCalledTimes(3);

		await app.close();
	});
});
