/**
 * A queued `docs-processing` job runs outside any request. Under DB_ORM=mikro-orm its stages read and write through
 * MikroORM (the tenant's storage settings and AI credentials, the activity log), which refuses its global
 * EntityManager there: every extraction failed and was dead-lettered, and every thumbnail silently never came.
 *
 * The worker's own dispatch (`QueueWorkerHost.process`, which the queue calls) is the real one; the pipeline is
 * doubled by a stage that, as MikroORM does, refuses to run outside a MikroORM request context.
 */
// The one helper taken from the platform's barrel (which boots the whole application graph) opens MikroORM's own request
// context under DB_ORM=mikro-orm, given the instance, as the platform's does; the work as it is otherwise.
jest.mock('@gauzy/core', () => ({
	runInMikroOrmContext: (orm: { em: unknown } | null | undefined, work: () => Promise<unknown>) =>
		orm && process.env.DB_ORM === 'mikro-orm'
			? jest.requireActual('@mikro-orm/core').RequestContext.create(orm.em, work)
			: work()
}));
jest.mock('./docs-pipeline.service', () => ({ DocsPipelineService: class {} }));
jest.mock('../../docs.config', () => ({ getDocsConfig: () => ({ queueConcurrency: 1 }) }));

import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import type { Job } from 'bullmq';
import { DOCS_JOB_EXTRACT, DOCS_JOB_IMPORT, DOCS_JOB_THUMBNAIL } from './constants';
import { DocsPipelineService } from './docs-pipeline.service';
import { DocsProcessingWorker } from './docs-processing.worker';

const PAYLOAD = { documentId: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1', reason: 'upload' };

/** A job as the queue hands it over. */
const queued = (name: string, id: string) =>
	({ id, name, data: PAYLOAD, opts: { attempts: 3 }, attemptsMade: 0 }) as unknown as Job;

describe('DocsProcessingWorker under DB_ORM=mikro-orm', () => {
	const originalOrm = process.env.DB_ORM;

	afterEach(() => {
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
	});

	/** The worker over a pipeline whose stages need a MikroORM request context, and the contexts they ran in. */
	function workerOver(orm?: unknown) {
		const ranIn: Array<{ stage: string; em: unknown }> = [];
		const throughMikroOrm = (stage: string) =>
			jest.fn(async () => {
				const em = MikroOrmRequestContext.getEntityManager();
				if (!em)
					throw new Error(
						'Using global EntityManager instance methods for context specific actions is disallowed.'
					);
				ranIn.push({ stage, em });
			});
		const pipeline = {
			handleExtract: throughMikroOrm('extract'),
			handleThumbnail: throughMikroOrm('thumbnail'),
			runStage: throughMikroOrm('import')
		};
		const worker = new DocsProcessingWorker(pipeline as unknown as DocsPipelineService, orm as never);
		return { worker, pipeline, ranIn };
	}

	it('runs each job in a MikroORM request context of its own', async () => {
		process.env.DB_ORM = 'mikro-orm';
		let forks = 0;
		const orm = { em: { name: 'default', fork: jest.fn(() => ({ name: 'default', fork: ++forks })) } };
		const { worker, ranIn } = workerOver(orm);

		await worker.process(queued(DOCS_JOB_EXTRACT, 'job-1'));
		await worker.process(queued(DOCS_JOB_THUMBNAIL, 'job-2'));
		await worker.process(queued(DOCS_JOB_IMPORT, 'job-3'));

		// A fresh fork for each job
		expect(ranIn).toEqual([
			{ stage: 'extract', em: { name: 'default', fork: 1 } },
			{ stage: 'thumbnail', em: { name: 'default', fork: 2 } },
			{ stage: 'import', em: { name: 'default', fork: 3 } }
		]);
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('opens none under TypeORM: a job runs as it is', async () => {
		process.env.DB_ORM = 'typeorm';
		const orm = { em: { name: 'default', fork: jest.fn() } };
		const { worker, pipeline } = workerOver(orm);
		pipeline.handleExtract.mockImplementation(async () => {
			expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
		});

		await worker.process(queued(DOCS_JOB_EXTRACT, 'job-1'));

		expect(pipeline.handleExtract).toHaveBeenCalledTimes(1);
		expect(orm.em.fork).not.toHaveBeenCalled();
	});
});
