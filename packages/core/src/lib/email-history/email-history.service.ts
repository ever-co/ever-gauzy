import { Injectable } from '@nestjs/common';
import { IEmailHistory, IPagination } from '@gauzy/contracts';
import { PaginationParams, TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { EmailHistory } from './email-history.entity';
import { MikroOrmEmailHistoryRepository, TypeOrmEmailHistoryRepository } from './repository';

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
	public async findAll(filter?: PaginationParams<EmailHistory>): Promise<IPagination<IEmailHistory>> {
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
	}
}
