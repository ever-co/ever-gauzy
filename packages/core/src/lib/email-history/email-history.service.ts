import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EmailStatusEnum, IEmailHistory, IPagination } from '@gauzy/contracts';
import { parseToBoolean } from '@gauzy/utils';
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
						...this.buildListFilters(filter.where)
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
					...this.buildListFilters(filter.where)
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

	/**
	 * The Email History list filters, read from the request's `where`.
	 *
	 * This route runs without `transform`, so the values arrive as raw query strings
	 * (`isArchived` is `"true"` / `"false"`). Only these four columns are taken from the
	 * client, each one checked, so nothing else in `where` reaches the query. Without an
	 * `isArchived` value the list stays on non-archived emails, as before.
	 *
	 * @param where - The raw `where` object of the request.
	 * @returns The column conditions to add to the list query.
	 */
	private buildListFilters(where: Record<string, any> = {}): Partial<IEmailHistory> {
		const { email, emailTemplateId, status, isArchived } = where;

		return {
			isArchived: parseToBoolean(isArchived),
			...(typeof email === 'string' && email ? { email } : {}),
			...(typeof emailTemplateId === 'string' && isUUID(emailTemplateId) ? { emailTemplateId } : {}),
			...(Object.values(EmailStatusEnum).includes(status) ? { status } : {})
		};
	}
}
