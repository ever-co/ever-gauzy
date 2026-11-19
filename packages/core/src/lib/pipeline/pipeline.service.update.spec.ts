import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { RequestContext } from '../core/context/request-context';
import { PipelineStage } from '../core/entities/internal';
import { Pipeline } from './pipeline.entity';
import { PipelineService } from './pipeline.service';

const TENANT_ID = 'tenant-1';
const PIPELINE_ID = 'pipeline-1';

/** A query runner whose manager answers the reads `update` makes and records its writes. */
function createQueryRunner(): Record<string, any> {
	return {
		connect: jest.fn().mockResolvedValue(undefined),
		startTransaction: jest.fn().mockResolvedValue(undefined),
		commitTransaction: jest.fn().mockResolvedValue(undefined),
		rollbackTransaction: jest.fn().mockResolvedValue(undefined),
		release: jest.fn().mockResolvedValue(undefined),
		manager: {
			findOneByOrFail: jest.fn(),
			create: jest.fn((_target, entity) => entity),
			findBy: jest.fn().mockResolvedValue([]),
			remove: jest.fn(),
			save: jest.fn()
		}
	};
}

/** The service, with the nested ownership check passing and every transaction run on `queryRunner`. */
function createService(queryRunner: Record<string, any>): PipelineService {
	const service: PipelineService = Object.create(PipelineService.prototype);
	Object.assign(service, {
		assertNestedGraphNotForeign: jest.fn().mockResolvedValue(undefined),
		connectionEntityManager: { rawConnection: { createQueryRunner: () => queryRunner } }
	});
	return service;
}

/**
 * `PipelineService.update` rolled the transaction back on any failure, logged it, and answered `undefined`:
 * `PUT /pipelines/:id` replied 202 with an empty body, and the `updatePipeline` mutation answered the pipeline as
 * it stood, so an edit that wrote nothing read as a success. The rollback and the log stay; the failure is now
 * reported after them.
 */
describe('PipelineService.update — a rolled-back edit is reported', () => {
	let queryRunner: Record<string, any>;
	let service: PipelineService;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		queryRunner = createQueryRunner();
		service = createService(queryRunner);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('answers 404 when the pipeline is not found, after rolling back', async () => {
		queryRunner.manager.findOneByOrFail.mockRejectedValue(
			new EntityNotFoundError(Pipeline, { id: PIPELINE_ID, tenantId: TENANT_ID })
		);

		await expect(service.update(PIPELINE_ID, { name: 'Renamed' })).rejects.toBeInstanceOf(NotFoundException);
		expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
		expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
		expect(queryRunner.release).toHaveBeenCalledTimes(1);
	});

	it('answers 400 with the cause when a write fails, after rolling back', async () => {
		queryRunner.manager.findOneByOrFail.mockResolvedValue({ id: PIPELINE_ID, tenantId: TENANT_ID });
		queryRunner.manager.save.mockRejectedValue(new Error('duplicate key value'));

		const failure = service.update(PIPELINE_ID, { name: 'Renamed' });

		await expect(failure).rejects.toBeInstanceOf(BadRequestException);
		await expect(failure).rejects.toThrow('duplicate key value');
		expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
		expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
		expect(queryRunner.release).toHaveBeenCalledTimes(1);
	});

	it('passes an HTTP exception through as it is, after rolling back', async () => {
		const refusal = new ForbiddenException('Not yours');
		queryRunner.manager.findOneByOrFail.mockRejectedValue(refusal);

		await expect(service.update(PIPELINE_ID, { name: 'Renamed' })).rejects.toBe(refusal);
		expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
	});
});

/**
 * An edit without `stages` (a rename, an archive) removed every stage of the pipeline, and each stage took its
 * deals with it. Only an edit that states `stages` replaces them now; `stages: []` still removes them all.
 */
describe('PipelineService.update: the stages an edit leaves out', () => {
	const ORGANIZATION_ID = 'organization-1';
	const CONTACTED = { id: 'stage-1', name: 'Contacted', index: 1, pipelineId: PIPELINE_ID, tenantId: TENANT_ID };
	const PROPOSAL = { id: 'stage-2', name: 'Proposal', index: 2, pipelineId: PIPELINE_ID, tenantId: TENANT_ID };

	let queryRunner: Record<string, any>;
	let service: PipelineService;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);

		queryRunner = createQueryRunner();
		queryRunner.manager.findOneByOrFail.mockResolvedValue({
			id: PIPELINE_ID,
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID
		});
		queryRunner.manager.findBy.mockResolvedValue([{ ...CONTACTED }, { ...PROPOSAL }]);
		queryRunner.manager.remove.mockResolvedValue(undefined);
		queryRunner.manager.save.mockImplementation((_target, entity) => Promise.resolve(entity));
		service = createService(queryRunner);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/** The stage rows the edit saved, in the order it saved them. */
	function savedStages(): Record<string, any>[] {
		const stageSaves = queryRunner.manager.save.mock.calls.filter(([target]) => target === PipelineStage);
		return stageSaves.map(([, stage]) => stage);
	}

	it('changes only the pipeline when the edit states no stages', async () => {
		await service.update(PIPELINE_ID, { name: 'Trail partnerships 2026', organizationId: ORGANIZATION_ID });

		expect(queryRunner.manager.remove).not.toHaveBeenCalled();
		expect(savedStages()).toEqual([]);
		expect(queryRunner.manager.save).toHaveBeenCalledTimes(1);
		expect(queryRunner.manager.save).toHaveBeenCalledWith(
			Pipeline,
			expect.objectContaining({
				id: PIPELINE_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				name: 'Trail partnerships 2026'
			})
		);
		expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
	});

	it('keeps the listed stages, creates the new ones and removes the others', async () => {
		await service.update(PIPELINE_ID, {
			name: 'Trail partnerships',
			stages: [{ id: CONTACTED.id, name: 'Contacted' }, { name: 'Won' }]
		});

		expect(queryRunner.manager.remove).toHaveBeenCalledTimes(1);
		expect(queryRunner.manager.remove).toHaveBeenCalledWith(
			PipelineStage,
			expect.objectContaining({ id: PROPOSAL.id })
		);
		expect(savedStages()).toEqual([
			expect.objectContaining({
				name: 'Won',
				index: 2,
				pipelineId: PIPELINE_ID,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID
			}),
			expect.objectContaining({ id: CONTACTED.id, index: 1, pipelineId: PIPELINE_ID })
		]);
		expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
	});

	it('removes every stage when the edit states an empty list', async () => {
		await service.update(PIPELINE_ID, { name: 'Trail partnerships', stages: [] });

		expect(queryRunner.manager.remove).toHaveBeenCalledTimes(2);
		expect(queryRunner.manager.remove).toHaveBeenCalledWith(
			PipelineStage,
			expect.objectContaining({ id: CONTACTED.id })
		);
		expect(queryRunner.manager.remove).toHaveBeenCalledWith(
			PipelineStage,
			expect.objectContaining({ id: PROPOSAL.id })
		);
		expect(savedStages()).toEqual([]);
		expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
	});
});
