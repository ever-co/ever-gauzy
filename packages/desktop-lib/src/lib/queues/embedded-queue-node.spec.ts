import { restoreUtilTypeChecks } from './embedded-queue-node';

/**
 * The timer's default (in-memory) job queue is `embedded-queue`, whose store is `nedb` — and nedb calls
 * `util.isDate` / `util.isRegExp`, which Node 23 removed. Electron 44 runs Node 24, so every job the queue
 * stored threw "TypeError: util.isDate is not a function" (found by the desktop-timer e2e on the packaged app:
 * "Error on return time slot", "IPCRTNSLOT", unhandled UIError). This runs the real queue on this Node.
 */
describe('embedded-queue on Node >= 23', () => {
	it('stores and processes a job once the util type checks it needs are restored', async () => {
		restoreUtilTypeChecks();
		// Required after the restore, the way TimerHandler does it.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const EmbeddedQueue = require('embedded-queue');
		const queue = await EmbeddedQueue.Queue.createQueue({ inMemoryOnly: true });
		const processed = new Promise((resolve) => queue.process('e2e', async (job: { data: unknown }) => resolve(job.data), 1));

		await queue.createJob({ type: 'e2e', data: { recordedAt: new Date('2026-10-14T00:00:00Z'), id: 1 } });

		await expect(processed).resolves.toEqual({ recordedAt: new Date('2026-10-14T00:00:00Z'), id: 1 });
		await queue.shutdown(1000);
	});

	it('keeps an existing implementation and matches only real Dates and RegExps', () => {
		const target: Record<string, unknown> = { isDate: 'kept' };
		restoreUtilTypeChecks(target);
		expect(target['isDate']).toBe('kept');
		const isRegExp = target['isRegExp'] as (v: unknown) => boolean;
		expect(isRegExp(/x/)).toBe(true);
		expect(isRegExp('/x/')).toBe(false);
	});
});
