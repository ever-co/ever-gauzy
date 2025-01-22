import { Injectable } from '@nestjs/common';
import { FindManyOptions, FindOneOptions, FindOptionsWhere, Raw, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IDeal, IPagination, IPipeline, IPipelineStage } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { ConnectionEntityManager } from '../database/connection-entity-manager';
import { prepareSQLQuery as p } from './../database/database.helper';
import { Pipeline } from './pipeline.entity';
import { PipelineStage } from './../core/entities/internal';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { TypeOrmDealRepository } from '../deal/repository/type-orm-deal.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmPipelineRepository } from './repository/type-orm-pipeline.repository';
import { MikroOrmPipelineRepository } from './repository/mikro-orm-pipeline.repository';

@Injectable()
export class PipelineService extends TenantAwareCrudService<Pipeline> {
	public constructor(
		readonly typeOrmPipelineRepository: TypeOrmPipelineRepository,
		readonly mikroOrmPipelineRepository: MikroOrmPipelineRepository,
		readonly typeOrmDealRepository: TypeOrmDealRepository,
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly connectionEntityManager: ConnectionEntityManager
	) {
		super(typeOrmPipelineRepository, mikroOrmPipelineRepository);
	}

	/**
	 * Find a Pipeline by ID
	 *
	 * @param id - The ID of the Pipeline to find
	 * @param relations - Optional relations to include in the query
	 * @returns The found Pipeline
	 */
	async findById(id: ID, options?: FindOneOptions<Pipeline>): Promise<IPipeline> {
		return await super.findOneByIdString(id, options);
	}

	/**
	 * Finds deals for a given pipeline.
	 *
	 * @param pipelineId - The ID of the pipeline to find deals for.
	 * @returns An object containing an array of deals and the total number of deals.
	 */
	public async getPipelineDeals(pipelineId: ID, where?: FindOptionsWhere<Pipeline>) {
		// Retrieve the current tenant ID from the request context
		const tenantId = RequestContext.currentTenantId();
		const { organizationId } = where || {};

		// Fetch deals related to the pipeline, grouping by stage and deal IDs
		const items: IDeal[] = await this.typeOrmDealRepository
			.createQueryBuilder('deal')
			.leftJoin('deal.stage', 'pipeline_stage')
			.where(p('pipeline_stage.pipelineId = :pipelineId'), { pipelineId })
			.andWhere(p('pipeline_stage.tenantId = :tenantId'), { tenantId })
			.andWhere(p('pipeline_stage.organizationId = :organizationId'), { organizationId })
			.groupBy(p('pipeline_stage.id'))
			// FIX: error: column "deal.id" must appear in the GROUP BY clause or be used in an aggregate function
			.addGroupBy(p('deal.id'))
			// END_FIX
			.orderBy(p('pipeline_stage.index'), 'ASC')
			.getMany();

		// Get the total number of deals
		const { length: total } = items;

		// For each deal, fetch the user who created it
		for (const deal of items) {
			deal.createdBy = await this.typeOrmUserRepository.findOneBy({ id: deal.createdByUserId });
		}

		// Return the deals and their total count
		return { items, total };
	}

	/**
	 * Updates a Pipeline entity and its stages within a transaction.
	 *
	 * @param id - The ID of the Pipeline to update.
	 * @param entity - The partial entity data to update.
	 * @returns The result of the update operation.
	 */
	public async update(id: ID, partialEntity: QueryDeepPartialEntity<Pipeline>): Promise<UpdateResult | Pipeline> {
		const queryRunner = this.connectionEntityManager.rawConnection.createQueryRunner();

		try {
			// Retrieve the current tenant ID from the request context
			const tenantId = RequestContext.currentTenantId();

			// Connect and start transaction
			await queryRunner.connect();
			await queryRunner.startTransaction();

			// Fetch the existing pipeline
			await queryRunner.manager.findOneByOrFail(Pipeline, { id, tenantId });

			// Create a new pipeline instance with the updated data
			const pipeline: Pipeline = queryRunner.manager.create(
				Pipeline,
				new Pipeline({
					...partialEntity,
					id,
					tenantId
				})
			);

			// Fetch existing pipeline stages
			const existingStages: IPipelineStage[] = await queryRunner.manager.findBy(PipelineStage, {
				pipelineId: id,
				tenantId
			});

			// Get the updated and existing stages
			const updatedStages: IPipelineStage[] = pipeline.stages?.filter((stage: IPipelineStage) => stage.id) || [];

			// Create a list of stage IDs that are being updated
			const requestStageIds = updatedStages.map((stage) => stage.id);

			// Identify stages to be deleted
			const deletedStages = existingStages.filter((stage) => !requestStageIds.includes(stage.id));

			//Identify stages to be created
			const createdStages = (pipeline.stages ?? []).filter(
				(stage) => !updatedStages.some((updatedStage) => updatedStage.id === stage.id)
			);

			// Prepare the pipeline for saving
			pipeline.__before_persist();
			delete pipeline.stages;

			// Perform stage deletions, creations, and updates concurrently
			await Promise.all([
				...deletedStages.map((stage) => queryRunner.manager.remove(PipelineStage, stage)),
				...createdStages.map((stage) => queryRunner.manager.save(PipelineStage, stage)),
				...updatedStages.map((stage) => queryRunner.manager.save(PipelineStage, stage))
			]);

			// Save the updated pipeline
			const updatePipeline = await queryRunner.manager.save(Pipeline, pipeline);
			await queryRunner.commitTransaction();

			return updatePipeline;
		} catch (error) {
			console.log('Rollback Pipeline Transaction', error);
			await queryRunner.rollbackTransaction();
		} finally {
			await queryRunner.release();
		}
	}

	/**
	 * Perform pagination with filtering based on the provided options.
	 *
	 * @param filter - The filtering options.
	 * @returns The paginated result.
	 */
	public async pagination(filter: FindManyOptions): Promise<IPagination<IPipeline>> {
		if (filter.where) {
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';
			const { name, description, stages } = filter.where as any; // Type assertion for easier destructuring

			if (name) {
				filter.where['name'] = Raw((alias) => `${alias} ${likeOperator} '%${name}%'`);
			}
			if (description) {
				filter.where['description'] = Raw((alias) => `${alias} ${likeOperator} '%${description}%'`);
			}
			if (stages) {
				filter.where['stages'] = {
					name: Raw((alias) => `${alias} ${likeOperator} '%${stages}%'`)
				};
			}
		}
		return await super.paginate(filter);
	}
}
