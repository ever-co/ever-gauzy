import { CrudService } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import {
	DeepPartial,
	EntityManager,
	FindConditions,
	Repository,
	Transaction,
	TransactionManager,
	UpdateResult
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Stage } from '../stage/stage.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PipelineService extends CrudService<Pipeline> {
	public constructor(
		@InjectRepository(Pipeline)
		pipelineRepository: Repository<Pipeline>
	) {
		super(pipelineRepository);
	}

	@Transaction()
	public async create(
		entity: DeepPartial<Pipeline>,
		@TransactionManager() manager: EntityManager,
		...options
	): Promise<Pipeline> {
		// Persist pipeline
		const { name, description, organizationId } = entity;
		const pipeline = await manager.save(
			manager.create(Pipeline, {
				organizationId,
				description,
				name
			})
		);
		const { id: pipelineId } = pipeline;
		let index = 0;

		// Persist pipeline stages
		if (entity.stages?.length) {
			for (const { name, description } of entity.stages) {
				await manager.save(
					manager.create(Stage, {
						index: ++index,
						description,
						pipelineId,
						name
					})
				);
			}
		}

		return pipeline;
	}

	@Transaction()
	public async update(
		id: string | number | FindConditions<Pipeline>,
		partialEntity: QueryDeepPartialEntity<Pipeline>,
		@TransactionManager() manager: EntityManager,
		...options
	): Promise<UpdateResult | Pipeline> {
		const updatedStages =
			partialEntity.stages?.filter(({ id }) => id) || [];
		const deletedStages = await manager
			.find(Stage, {
				where: {
					pipelineId: id
				},
				select: ['id']
			})
			.then((stages) => {
				const requestStageIds = updatedStages?.map(({ id }) => id);

				return stages.filter(({ id }) => !requestStageIds.includes(id));
			});
		const createdStages = partialEntity.stages?.filter(
			(stage) => !updatedStages.includes(stage)
		);
		const pipeline = await manager.findOne(Pipeline, id as any);
		const _pipeline = { ...partialEntity };

		partialEntity.stages?.forEach((stage, index) => {
			stage.pipelineId = pipeline.id;
			stage.index = ++index;
		});
		delete _pipeline.stages;

		await manager.remove(deletedStages);
		await Promise.all(
			createdStages.map((stage) => {
				stage = manager.create(Stage, stage as DeepPartial<Stage>);

				return manager.save(stage);
			})
		);
		await Promise.all(
			updatedStages.map((stage) => manager.update(Stage, stage.id, stage))
		);

		return await manager.update(Pipeline, id, _pipeline);
	}
}
