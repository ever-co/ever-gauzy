import { TenantAwareCrudService } from './../core/crud';
import { Pipeline } from './pipeline.entity';
import {
	DeepPartial,
	EntityManager,
	FindConditions,
	Like,
	Repository,
	Transaction,
	TransactionManager,
	UpdateResult
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Injectable } from '@nestjs/common';
import { Deal } from '../deal/deal.entity';
import { User } from '../user/user.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class PipelineService extends TenantAwareCrudService<Pipeline> {
	public constructor(
		@InjectRepository(Deal)
		protected dealRepository: Repository<Deal>,
		@InjectRepository(Pipeline)
		protected pipelineRepository: Repository<Pipeline>,
		@InjectRepository(User)
		protected userRepository: Repository<User>
	) {
		super(pipelineRepository);
	}

	public async findDeals(pipelineId: string) {
		const tenantId = RequestContext.currentTenantId();
		const items: Deal[] = await this.dealRepository
			.createQueryBuilder('deal')
			.leftJoin('deal.stage', 'pipeline_stage')
			.where('pipeline_stage.pipelineId = :pipelineId', { pipelineId })
			.andWhere('pipeline_stage.tenantId = :tenantId', { tenantId })
			.groupBy('pipeline_stage.id')
			// FIX: error: column "deal.id" must appear in the GROUP BY clause or be used in an aggregate function
			.addGroupBy('deal.id')
			// END_FIX
			.orderBy('pipeline_stage.index', 'ASC')
			.getMany();

		const { length: total } = items;

		for (const deal of items) {
			deal.createdBy = await this.userRepository.findOne(
				deal.createdByUserId
			);
		}

		return { items, total };
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
			.find(PipelineStage, {
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
				stage = manager.create(
					PipelineStage,
					stage as DeepPartial<PipelineStage>
				);

				return manager.save(stage);
			})
		);
		await Promise.all(
			updatedStages.map((stage) =>
				manager.update(PipelineStage, stage.id, stage)
			)
		);

		return await manager.update(Pipeline, id, pipeline);
	}

	public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('name' in where) {
				const { name } = where;
				filter.where.name = Like(`%${name}%`)
			}
			if ('description' in where) {
				const { description } = where;
				filter.where.description = Like(`%${description}%`)
			}
		}
		return super.paginate(filter);
	}
}
