import { Injectable } from '@nestjs/common';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
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
	 *
	 * **`withDeleted` is honoured on both ORMs.** This method builds its own reads rather than going
	 * through the CRUD base, so a member of `filter` it does not name is dropped — and the flag used to be
	 * one of them, answering the live rows to a caller who asked for the retired ones. On MikroORM soft
	 * delete is a filter, disabled by name for this one read; on TypeORM it is the query builder's own
	 * `deletedAt IS NULL`, lifted with `withDeleted()`. Neither touches the `tenantId` / `organizationId`
	 * the read pins, so a retired row of another tenant stays as unreachable as a live one.
	 *
	 * @param filter Optional filtering options.
	 * @returns A paginated list of email history records.
	 */
	public async findAll(filter?: BaseQueryDTO<EmailHistory>): Promise<IPagination<IEmailHistory>> {
		// The GraphQL field hands a boolean; the REST list route's pipe does not transform, so its query
		// string arrives as 'true' / 'false', and a truthiness test would read 'false' as true.
		const withDeleted = parseToBoolean(filter?.withDeleted);

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
						orderBy: { createdAt: 'DESC' } as any,
						// Only the soft-delete filter is disabled, by name: the tenant scope is the where above.
						...(withDeleted ? { filters: { [SOFT_DELETABLE_FILTER]: false } } : {})
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

				// Lifts only the builder's own `deletedAt IS NULL`; the tenant scope is the `where` above.
				if (withDeleted) {
					query.withDeleted();
				}

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
