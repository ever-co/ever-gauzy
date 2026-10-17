import { Repository } from 'typeorm';
import { FilterQuery } from '@mikro-orm/core';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { MikroOrmBaseEntityRepository } from '../core/repository/mikro-orm-base-entity.repository';
import { MultiORM, MultiORMEnum } from '../core/utils';

/**
 * Reads the criteria rows (technologies or personal qualities) of an interview of the current tenant.
 *
 * The tenant is checked on the interview, not on the row: rows saved before the bulk create stamped a tenant
 * have a NULL `tenantId` and stay readable by their interview's tenant, while an interview of another tenant
 * gives no rows. The interview is joined whatever its soft-delete state, as the read did not look at it
 * before, and the row's own soft delete still applies.
 *
 * @param ormType The ORM the service runs on.
 * @param typeOrmRepository The criteria's TypeORM repository.
 * @param mikroOrmRepository The criteria's MikroORM repository.
 * @param interviewId The interview whose criteria are read.
 * @returns The interview's criteria, or none when the interview is not the current tenant's.
 */
export async function findTenantInterviewCriteria<T extends { interviewId?: ID }>(
	ormType: MultiORM,
	typeOrmRepository: Repository<T>,
	mikroOrmRepository: MikroOrmBaseEntityRepository<T>,
	interviewId: ID
): Promise<T[]> {
	const tenantId = RequestContext.currentTenantId();

	switch (ormType) {
		case MultiORMEnum.MikroORM:
			return await mikroOrmRepository.find(
				{ interviewId, deletedAt: null, interview: { tenantId } } as FilterQuery<T>,
				{
					filters: { [SOFT_DELETABLE_FILTER]: false }
				}
			);
		case MultiORMEnum.TypeORM:
		default:
			// `withDeleted()` comes before the join, which is when TypeORM adds the joined row's soft-delete check.
			return await typeOrmRepository
				.createQueryBuilder('criterion')
				.withDeleted()
				.innerJoin('criterion.interview', 'interview')
				.where('criterion.interviewId = :interviewId', { interviewId })
				.andWhere('criterion.deletedAt IS NULL')
				.andWhere('interview.tenantId = :tenantId', { tenantId })
				.getMany();
	}
}
