import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, DeepPartial, FindManyOptions, FindOptionsWhere, Raw, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPipelineStage } from '@gauzy/contracts';
import { Pipeline } from './pipeline.entity';
import { Deal, PipelineStage, User } from './../core/entities/internal';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from './../core/crud';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmDealRepository } from '../deal/repository/type-orm-deal.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmPipelineRepository } from './repository/type-orm-pipeline.repository';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';
import { isPostgres } from '@gauzy/config';

@Injectable()
export class PipelineService extends TenantAwareCrudService<Pipeline> {
	public constructor(
		@InjectRepository(Pipeline)
		readonly typeOrmPipelineRepository: TypeOrmPipelineRepository,

		readonly mikroOrmPipelineRepository: MikroOrmPipelineRepository,

		@InjectRepository(Deal)
		readonly typeOrmDealRepository: TypeOrmDealRepository,

		@InjectRepository(User)
		readonly typeOrmUserRepository: TypeOrmUserRepository,

		@InjectConnection()
		private readonly connection: Connection
	) {
		super(typeOrmPipelineRepository, mikroOrmPipelineRepository);
	}

	public async findDeals(pipelineId: string) {
		const tenantId = RequestContext.currentTenantId();
		const items: Deal[] = await this.typeOrmDealRepository
			.createQueryBuilder('deal')
			.leftJoin('deal.stage', 'pipeline_stage')
			.where(p('pipeline_stage.pipelineId = :pipelineId'), { pipelineId })
			.andWhere(p('pipeline_stage.tenantId = :tenantId'), { tenantId })
			.groupBy(p('pipeline_stage.id'))
			// FIX: error: column "deal.id" must appear in the GROUP BY clause or be used in an aggregate function
			.addGroupBy(p('deal.id'))
			// END_FIX
			.orderBy(p('pipeline_stage.index'), 'ASC')
			.getMany();

		const { length: total } = items;

		for (const deal of items) {
			deal.createdBy = await this.typeOrmUserRepository.findOneBy({
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

		try {
			/**
			 * Query runner connect & start transaction
			 */
			await queryRunner.connect();
			await queryRunner.startTransaction();

			await queryRunner.manager.findOneByOrFail(Pipeline, {
				id: id as any
			});

			const pipeline: Pipeline = await queryRunner.manager.create(Pipeline, { id: id as any, ...entity } as any);
			const updatedStages: IPipelineStage[] = pipeline.stages?.filter((stage: IPipelineStage) => stage.id) || [];

			const deletedStages = await queryRunner.manager
				.findBy(PipelineStage, {
					pipelineId: id as any
				})
				.then((stages: IPipelineStage[]) => {
					const requestStageIds = updatedStages.map((updatedStage: IPipelineStage) => updatedStage.id);
					return stages.filter((stage: IPipelineStage) => !requestStageIds.includes(stage.id));
				});

			const createdStages =
				pipeline.stages?.filter((stage: IPipelineStage) => !updatedStages.includes(stage)) || [];

			pipeline.__before_persist();
			delete pipeline.stages;

			await queryRunner.manager.remove(deletedStages);

			for await (const stage of createdStages) {
				await queryRunner.manager.save(
					queryRunner.manager.create(PipelineStage, stage as DeepPartial<PipelineStage>)
				);
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

	/**
	 *
	 * @param filter
	 * @returns
	 */
	public pagination(filter: FindManyOptions) {
		if ('where' in filter) {
			const { where } = filter;
			const insensitiveOperator = isPostgres() ? 'ILIKE' : 'LIKE';
			if ('name' in where) {
				const { name } = where;
				filter['where']['name'] = Raw((alias) => `${alias} ${insensitiveOperator} '%${name}%'`);
			}
			if ('description' in where) {
				const { description } = where;
				filter['where']['description'] = Raw((alias) => `${alias} ${insensitiveOperator} '%${description}%'`);
			}
			if ('isActive' in where) {
				const { isActive } = where;
				if (isActive === 'active') {
					filter['where']['isActive'] = 1;
				}
				if (isActive === 'inactive') {
					filter['where']['isActive'] = 0;
				}
			}
			if ('stages' in where) {
				const { stages } = where;
				filter['where']['stages'] = {
					name: Raw((alias) => `${alias} ${insensitiveOperator} '%${stages}%'`)
				};
			}
		}
		return super.paginate(filter);
	}
}
