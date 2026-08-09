import {
	ENV_GAUZY_DOCS_AI_ENABLED,
	ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED,
	ENV_GAUZY_DOCS_OCR_ENABLED,
	ENV_GAUZY_DOCS_QUEUE_ENABLED
} from './docs.constants';
import { getDocsConfig, isDocsQueueEnabled } from './docs.config';

/**
 * Pins the ON/OFF defaults of the optional Documents sub-features (owner decision, 2026-08-09).
 *
 * These are not arbitrary. Each default is safe only because a second gate exists downstream, and
 * that pairing is what this suite protects — flipping a default without its gate is how a
 * deployment with no AI configured starts failing every upload, or an unsigned webhook starts
 * accepting documents.
 */
describe('Documents sub-feature defaults', () => {
	const KEYS = [
		ENV_GAUZY_DOCS_AI_ENABLED,
		ENV_GAUZY_DOCS_OCR_ENABLED,
		ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED,
		ENV_GAUZY_DOCS_QUEUE_ENABLED
	];

	const saved: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of KEYS) {
			saved[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of KEYS) {
			if (saved[key] === undefined) delete process.env[key];
			else process.env[key] = saved[key];
		}
	});

	describe('with nothing configured', () => {
		it('enables AI, OCR and inbound email', () => {
			const config = getDocsConfig();

			expect(config.aiEnabled).toBe(true);
			expect(config.ocrEnabled).toBe(true);
			expect(config.inboundEmailEnabled).toBe(true);
		});

		/**
		 * 🛑 The one that must stay OFF. Enabling the BullMQ queue without a Bull root connection in
		 * the process registers a `@Processor` with no connection, which throws
		 * `Worker requires a connection` during `onModuleInit` and takes the whole API down — it
		 * crash-looped demo and stage for hours. With it off the pipeline runs inline and works.
		 */
		it('leaves the queue OFF', () => {
			expect(isDocsQueueEnabled()).toBe(false);
		});

		/** Safe-by-default: no secret means the inbound route accepts nothing, however "enabled" it is. */
		it('ships no inbound webhook secret, so the route can accept nothing', () => {
			expect(getDocsConfig().inboundWebhookSecret).toBeUndefined();
		});
	});

	describe('explicit opt-out still wins', () => {
		it.each([
			[ENV_GAUZY_DOCS_AI_ENABLED, 'aiEnabled'],
			[ENV_GAUZY_DOCS_OCR_ENABLED, 'ocrEnabled'],
			[ENV_GAUZY_DOCS_INBOUND_EMAIL_ENABLED, 'inboundEmailEnabled']
		])('%s=false turns %s off', (key: string, field: string) => {
			process.env[key] = 'false';

			expect(getDocsConfig()[field as 'aiEnabled']).toBe(false);
		});

		it('GAUZY_DOCS_QUEUE_ENABLED=true is still honoured for a process that really has a Bull root', () => {
			process.env[ENV_GAUZY_DOCS_QUEUE_ENABLED] = 'true';

			expect(isDocsQueueEnabled()).toBe(true);
		});
	});
});
