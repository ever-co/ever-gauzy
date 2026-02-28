import { Injectable } from '@nestjs/common';
import { IEmailHistory, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { MultiORMEnum } from '../core/utils';
import { EmailHistory } from './email-history.entity';
import { TypeOrmEmailHistoryRepository } from './repository/type-orm-email-history.repository';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';
@Injectable()
export class EmailHistoryService extends TenantAwareCrudService<EmailHistory> {
	constructor(
		typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,
		mikroOrmEmailHistoryRepository: MikroOrmEmailHistoryRepository
	) {
		super(typeOrmEmailHistoryRepository, mikroOrmEmailHistoryRepository);
	}

	/**
	 * Retrieves a list of email history records with optional filtering.
	 * @param filter Optional filtering options.
	 * @returns A paginated list of email history records.
	 */
	public async findAll(filter?: BaseQueryDTO<EmailHistory>): Promise<IPagination<IEmailHistory>> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const { organizationId: mOrgId } = filter.where;
				const mTenantId = RequestContext.currentTenantId() || filter.where.tenantId;

				const [mItems, mTotal] = await this.mikroOrmRepository.findAndCount(
					{
						organizationId: mOrgId,
						tenantId: mTenantId,
						isActive: true,
						isArchived: false
					} as any,
					{
						populate: ['user', 'emailTemplate'] as any[],
						limit: filter.take ? (filter.take as number) : 20,
						orderBy: { createdAt: 'DESC' } as any
					}
				);
				return {
					items: mItems.map((item) => this.serialize(item)),
					total: mTotal
				};

			case MultiORMEnum.TypeORM:
				const query = this.typeOrmRepository.createQueryBuilder('email_sent');
				query.leftJoin(`${query.alias}.user`, 'user');
				query.leftJoin(`${query.alias}.emailTemplate`, 'emailTemplate');
				query.addSelect(['user.email', 'user.firstName', 'user.lastName', 'user.imageUrl']);

				const { organizationId } = filter.where;
				const tenantId = RequestContext.currentTenantId() || filter.where.tenantId;

				query.where({
					organizationId,
					tenantId,
					isActive: true,
					isArchived: false
				});

				query.take(filter.take ? (filter.take as number) : 20);
				query.orderBy(`${query.alias}.createdAt`, 'DESC');

				const [items, total] = await query.getManyAndCount();
				return {
					items,
					total
				};

			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}
}
