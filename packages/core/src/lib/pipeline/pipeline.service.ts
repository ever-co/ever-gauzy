import { Injectable } from '@nestjs/common';
import { FindManyOptions, FindOneOptions, FindOptionsWhere, Raw, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID, IDeal, IPagination, IPipeline, IPipelineStage } from '@gauzy/contracts';
import { ConnectionEntityManager } from '../database/connection-entity-manager';
import { Pipeline } from './pipeline.entity';
import { Deal, PipelineStage } from './../core/entities/internal';
import { RequestContext } from '../core/context/request-context';
import { LIKE_OPERATOR } from '../core/util';
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
	 * @param where - Additional conditions to filter the deals.
	 * @returns An object containing an array of deals and the total number of deals.
	 */
	public async getPipelineDeals(
		pipelineId: ID,
		where?: FindOptionsWhere<Pipeline>,
		relations: string[] = []
	): Promise<IPagination<IDeal>> {
		// Destructure organizationId and tenantId from where; fallback to current tenant if not provided
		const { organizationId } = where ?? {};
		const tenantId = RequestContext.currentTenantId() ?? where?.tenantId;

		// Prepare query options with ordering; add relations only if provided
		const queryOptions: FindManyOptions<Deal> = {
			// Build the where clause for the query
			where: {
				organizationId,
				tenantId,
				stage: {
					pipelineId,
					tenantId,
					organizationId
				}
			},
			order: { stage: { index: 'ASC' } }
		};

		if (relations.length) {
			queryOptions.relations = relations;
		}

		try {
			// Fetch deals and their total count
			const [items, total] = await this.typeOrmDealRepository.findAndCount(queryOptions);
			return { items, total };
		} catch (error) {
			console.error(`Error fetching pipeline deals: ${error.message}`, error);
			return { items: [], total: 0 };
		}
	}

	/**
	 * Updates a Pipeline entity and its stages within a transaction.
	 *
	 * @param id - The ID of the Pipeline to update.
	 * @param entity - The partial entity data to update.
	 * @returns The result of the update operation.
	 */
	public async update(id: ID, partialEntity: QueryDeepPartialEntity<Pipeline>): Promise<UpdateResult | Pipeline> {
		// Retrieve the current tenant ID from the request context
		const tenantId = RequestContext.currentTenantId();

		const queryRunner = this.connectionEntityManager.rawConnection.createQueryRunner();

		try {
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
	public async pagination(filters?: FindManyOptions<Pipeline>): Promise<IPagination<IPipeline>> {
		const whereOptions = filters?.where as FindOptionsWhere<Pipeline>;

		if (whereOptions) {
			const { name, description, stages } = whereOptions as FindOptionsWhere<Pipeline>;
			const additonalFilters: FindOptionsWhere<Pipeline> = {};

			if (name) {
				additonalFilters['name'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :name`, {
					name: `%${name}%`
				});
			}

			if (description) {
				additonalFilters['description'] = Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :description`, {
					description: `%${description}%`
				});
			}

			if (stages) {
				additonalFilters['stages'] = {
					name: Raw((alias: string) => `${alias} ${LIKE_OPERATOR} :stages`, { stages: `%${stages}%` })
				};
			}

			// Merge existing 'where' conditions with the new 'conditions'
			filters.where = { ...whereOptions, ...additonalFilters };
		}

		return super.paginate(filters ?? {});
	}
}
