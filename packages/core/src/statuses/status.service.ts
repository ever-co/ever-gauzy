import { Brackets, DeleteResult, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPagination, IStatus } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { PaginationParams, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from './../core/context';
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
	 * Get Accounting Templates using pagination params
	 *
	 * @param params
	 * @returns
	 */
	async findAll(
		params: PaginationParams<Status>
	): Promise<IPagination<Status>> {
		const query = this.repository.createQueryBuilder(this.alias);
		query.setFindOptions({
			select: {
				organization: {
					id: true,
					name: true,
					brandColor: true
				}
			}
		});
		query.where((qb: SelectQueryBuilder<Status>) => {
			qb.andWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					const { organizationId } = params.where;
					if (isNotEmpty(organizationId)) {
						bck.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
							organizationId
						});
					}
					bck.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId: RequestContext.currentTenantId()
					});
				})
			);
			qb.orWhere(
				new Brackets((bck: WhereExpressionBuilder) => {
					bck.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
					bck.andWhere(`"${qb.alias}"."projectId" IS NULL`);
				})
			);
		});
		const [items, total] = await query.getManyAndCount();
		return { items, total };
	}

	/**
	 * Few Statuses can't be removed/delete because they are global
	 * TaskStatusEnum.TODO, TaskStatusEnum.IN_PROGRESS, TaskStatusEnum.FOR_TESTING, TaskStatusEnum.COMPLETED
	 *
	 * @param id
	 * @returns
	 */
	async delete(id: IStatus['id']): Promise<DeleteResult> {
		return await super.delete(id, {
			where: {
				isSystem: false
			}
		})
	}
}