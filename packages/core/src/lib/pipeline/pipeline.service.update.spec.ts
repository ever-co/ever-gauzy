import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntityNotFoundError } from 'typeorm';
import { RequestContext } from '../core/context/request-context';
import { Pipeline } from './pipeline.entity';
import { PipelineService } from './pipeline.service';

/**
 * `PipelineService.update` rolled the transaction back on any failure, logged it, and answered `undefined`:
 * `PUT /pipelines/:id` replied 202 with an empty body, and the `updatePipeline` mutation answered the pipeline as
 * it stood, so an edit that wrote nothing read as a success. The rollback and the log stay; the failure is now
 * reported after them.
 */
describe('PipelineService.update — a rolled-back edit is reported', () => {
	const TENANT_ID = 'tenant-1';
	const PIPELINE_ID = 'pipeline-1';

	let queryRunner: Record<string, any>;
	let service: PipelineService;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);

		queryRunner = {
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

		service = Object.create(PipelineService.prototype);
		Object.assign(service, {
			assertNestedGraphNotForeign: jest.fn().mockResolvedValue(undefined),
			connectionEntityManager: { rawConnection: { createQueryRunner: () => queryRunner } }
		});
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
