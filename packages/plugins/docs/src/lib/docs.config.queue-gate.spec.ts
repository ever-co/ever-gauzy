import { isDocsQueueEnabled } from './docs.config';

/**
 * The queue gate decides whether `DocsModule` registers the `docs-processing` BullMQ queue and
 * the `DocsProcessingWorker` `@Processor`.
 *
 * It is covered on its own because getting it wrong does not degrade a feature — it takes the
 * whole API down. `@nestjs/bullmq`'s registrar builds a `Worker` for every `@Processor` during
 * `onModuleInit`, and with no `BullModule.forRoot()` connection in the process that constructor
 * throws `Worker requires a connection`, failing the Nest bootstrap. That is exactly what
 * happened when the default was `REDIS_ENABLED === 'true'`: Redis was reachable in the deployed
 * environments, but no process that loads the plugin list registers a Bull root, so the API
 * crash-looped.
 */
describe('isDocsQueueEnabled', () => {
	const ORIGINAL = { ...process.env };

	afterEach(() => {
		process.env = { ...ORIGINAL };
	});

	it('is OFF when nothing is configured, so the pipeline dispatches inline', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		delete process.env['REDIS_ENABLED'];

		expect(isDocsQueueEnabled()).toBe(false);
	});

	it('stays OFF when Redis is enabled — reachable Redis is not a Bull root', () => {
		delete process.env['GAUZY_DOCS_QUEUE_ENABLED'];
		process.env['REDIS_ENABLED'] = 'true';

		// The regression: this returning true registered a @Processor in an API process with no
		// Bull root, and every API pod crash-looped on `Worker requires a connection`.
		expect(isDocsQueueEnabled()).toBe(false);
	});

	it('turns ON only when explicitly opted in', () => {
		process.env['GAUZY_DOCS_QUEUE_ENABLED'] = 'true';
		delete process.env['REDIS_ENABLED'];

		expect(isDocsQueueEnabled()).toBe(true);
	});

	it('an explicit false wins over anything else in the environment', () => {
		process.env['GAUZY_DOCS_QUEUE_ENABLED'] = 'false';
		process.env['REDIS_ENABLED'] = 'true';

		expect(isDocsQueueEnabled()).toBe(false);
	});
});
