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
		protected pipelineRepository: Repository<Pipeline>
	) {
		super(pipelineRepository);
	}

	@Transaction()
	public async update(
		id: string | number | FindConditions<Pipeline>,
		partialEntity: QueryDeepPartialEntity<Pipeline>,
		@TransactionManager() manager: EntityManager,
		...options
	): Promise<UpdateResult | Pipeline> {
		const onePipeline = await manager.findOne(Pipeline, id as any);
		const pipeline = manager.create(Pipeline, {
			...partialEntity,
			id: onePipeline.id
		} as any);
		const updatedStages =
			pipeline.stages?.filter((stage) => stage.id) || [];
		const deletedStages = await manager
			.find(Stage, {
				where: {
					pipelineId: id
				},
				select: ['id']
			})
			.then((stages) => {
				const requestStageIds = updatedStages.map(
					(updatedStage) => updatedStage.id
				);

				return stages.filter(
					(stage) => !requestStageIds.includes(stage.id)
				);
			});
		const createdStages =
			pipeline.stages?.filter(
				(stage) => !updatedStages.includes(stage)
			) || [];

		// partialEntity.stages?.forEach((stage, index) => {
		// 	stage.pipelineId = pipeline.id;
		// 	stage.index = ++index;
		// });
		pipeline.__before_persist();
		delete pipeline.stages;

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

		return await manager.update(Pipeline, id, pipeline);
	}
}
