import { isNotEmpty } from "@gauzy/common";
import { Injectable } from "@nestjs/common";
import { IPagination, ITaskPriorityFindInput, ITaskSizeFindInput } from "@gauzy/contracts";
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";
import { TenantBaseEntity } from "./../core/entities/internal";
import { RequestContext } from "../core/context";
import { TenantAwareCrudService } from "../core/crud";

@Injectable()
export class SharedPrioritySizeService<BaseEntity extends TenantBaseEntity> extends TenantAwareCrudService<BaseEntity> {
    constructor(
        protected readonly repository: Repository<BaseEntity>
    ) {
        super(repository);
    }

	async findAllTaskShared(
		params: ITaskPriorityFindInput | ITaskSizeFindInput
	): Promise<IPagination<BaseEntity>> {
		try {
			/**
			 * Find at least one record or get global records
			 */
			const cqb = this.repository.createQueryBuilder(this.alias);
			cqb.where((qb: SelectQueryBuilder<BaseEntity>) => {
				this.getFilterQuery(qb, params);
			});
			await cqb.getOneOrFail();

			/**
			 * Find task sizes/priorities for given params
			 */
			const query = this.repository.createQueryBuilder(this.alias);
			query.where((qb: SelectQueryBuilder<BaseEntity>) => {
				this.getFilterQuery(qb, params);
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			return await this.getGlobal();
		}
	}

    /**
	 * GET global system statuses/priorities/sizes
	 *
	 * @returns
	 */
	async getGlobal(): Promise<IPagination<BaseEntity>> {
		const query = this.repository.createQueryBuilder(this.alias);
		query.where((qb: SelectQueryBuilder<BaseEntity>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."projectId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."isSystem" = :isSystem`, {
						isSystem: true,
					});
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

    /**
	 * GET status filter query
	 *
	 * @param query
	 * @param request
	 * @returns
	 */
	getFilterQuery(
		query: SelectQueryBuilder<BaseEntity>,
		request: ITaskPriorityFindInput | ITaskSizeFindInput
	) {
		const { tenantId, organizationId, projectId } = request;
		/**
		 * GET by tenant level
		 */
		if (isNotEmpty(tenantId)) {
			query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
				tenantId: RequestContext.currentTenantId(),
			});
		} else {
			query.andWhere(`"${query.alias}"."tenantId" IS NULL`);
		}
		/**
		 * GET by organization level
		 */
		if (isNotEmpty(organizationId)) {
			query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
                organizationId,
            });
		} else {
			query.andWhere(`"${query.alias}"."organizationId" IS NULL`);
		}
		/**
		 * GET by project level
		 */
		if (isNotEmpty(projectId)) {
			query.andWhere(`"${query.alias}"."projectId" = :projectId`, {
				projectId,
			});
		} else {
			query.andWhere(`"${query.alias}"."projectId" IS NULL`);
		}
		return query;
	}
}
