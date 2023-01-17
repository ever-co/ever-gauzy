import {
	Brackets,
	DeleteResult,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, IStatus, IStatusFindInput } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from '../core/crud';
import { Status } from './status.entity';

@Injectable()
export class StatusService extends TenantAwareCrudService<Status> {
	constructor(
		@InjectRepository(Status)
		private readonly statusRepository: Repository<Status>
	) {
		super(statusRepository);
	}

	/**
	 * GET statuses by filters
	 * If parameters not match, retrieve global statuses
	 *
	 * @param params
	 * @returns
	 */
	async findAllStatuses(
		params: IStatusFindInput
	): Promise<IPagination<Status>> {
		const query = this.repository.createQueryBuilder(this.alias);
		query.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true,
				},
			},
		});
		query.where((qb: SelectQueryBuilder<Status>) => {
			const { tenantId, organizationId, projectId } = params;
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					/**
					 * GET statuses by tenant level
					 */
					if (isNotEmpty(tenantId)) {
						bck.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
							tenantId,
						});
					} else {
						bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
					}
					/**
					 * GET statuses by organization level
					 */
					if (isNotEmpty(organizationId)) {
						bck.andWhere(
							`"${qb.alias}"."organizationId" = :organizationId`,
							{
								organizationId,
							}
						);
					} else {
						bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					}
					/**
					 * GET statuses by project level
					 */
					if (isNotEmpty(projectId)) {
						bck.andWhere(`"${qb.alias}"."projectId" = :projectId`, {
							projectId,
						});
					} else {
						bck.andWhere(`"${qb.alias}"."projectId" IS NULL`);
					}
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Few Statuses can't be removed/delete because they are global
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IStatus['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false,
			},
		});
	}
}
