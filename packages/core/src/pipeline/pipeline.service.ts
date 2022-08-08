import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import {
	Connection,
	DeepPartial,
	FindOptionsWhere,
	Like,
	Repository,
	UpdateResult
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPipelineStage } from '@gauzy/contracts';
import { Pipeline } from './pipeline.entity';
import { Deal, PipelineStage, User } from './../core/entities/internal';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class PipelineService extends TenantAwareCrudService<Pipeline> {
	public constructor(
		@InjectRepository(Deal)
		protected dealRepository: Repository<Deal>,

		@InjectRepository(Pipeline)
		protected pipelineRepository: Repository<Pipeline>,

		@InjectRepository(User)
		protected userRepository: Repository<User>,

		@InjectConnection()
		private readonly connection: Connection
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
			deal.createdBy = await this.userRepository.findOneBy({
				id: deal.createdByUserId
			});
		}

		return { items, total };
	}

	public async update(
		id: string | number | FindOptionsWhere<Pipeline>,
		entity: QueryDeepPartialEntity<Pipeline>
	): Promise<UpdateResult | Pipeline> {
		const queryRunner = this.connection.createQueryRunner();
		/**
		 * Query runner connect & start transaction
		 */
		await queryRunner.connect();
        await queryRunner.startTransaction();

		try {
			await queryRunner.manager.findOneByOrFail(Pipeline, {
				id: id as any
			});

			const pipeline: Pipeline = await queryRunner.manager.create(Pipeline, { id: id as any, ...entity, } as any);
			const updatedStages: IPipelineStage[] = pipeline.stages?.filter((stage: IPipelineStage) => stage.id) || [];

			const deletedStages = await queryRunner.manager.findBy(PipelineStage, {
				pipelineId: id as any
			}).then((stages: IPipelineStage[]) => {
				const requestStageIds = updatedStages.map(
					(updatedStage: IPipelineStage) => updatedStage.id
				);
				return stages.filter(
					(stage: IPipelineStage) => !requestStageIds.includes(stage.id)
				);
			});

			const createdStages = pipeline.stages?.filter(
				(stage: IPipelineStage) => !updatedStages.includes(stage)
			) || [];

			pipeline.__before_persist();
			delete pipeline.stages;

			await queryRunner.manager.remove(deletedStages);

			for await (const stage of createdStages) {
				await queryRunner.manager.save(queryRunner.manager.create(
					PipelineStage,
					stage as DeepPartial<PipelineStage>
				));
			}
			for await (const stage of updatedStages) {
				await queryRunner.manager.update(PipelineStage, stage.id, stage);
			}

			const saved = await queryRunner.manager.update(Pipeline, id, pipeline);
			await queryRunner.commitTransaction();

			return saved;
		} catch (error) {
			await queryRunner.rollbackTransaction();
		} finally {
			await queryRunner.release();
        }
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
			if ('isActive' in where) {
				const { isActive } = where;
				if (isActive === 'active') {
					filter.where.isActive = 1;
				}
				if (isActive === 'inactive') {
					filter.where.isActive = 0;
				}
			}
			if ('stages' in where) {
				const { stages } = where;
				filter.where.stages = {
					name: Like(`%${stages}%`)
				}
			}
		}
		return super.paginate(filter);
	}
}
