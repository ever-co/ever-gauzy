import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions } from 'typeorm';
import { IEmailHistory, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { EmailHistory } from './email-history.entity';
import { TypeOrmEmailHistoryRepository } from './repository/type-orm-email-history.repository';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';
import { prepareSQLQuery as p } from './../database/database.helper';

@Injectable()
export class EmailHistoryService extends TenantAwareCrudService<EmailHistory> {
	constructor(
		@InjectRepository(EmailHistory)
		typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,

		mikroOrmEmailHistoryRepository: MikroOrmEmailHistoryRepository
	) {
		super(typeOrmEmailHistoryRepository, mikroOrmEmailHistoryRepository);
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	public async findAll(filter?: FindManyOptions<EmailHistory>): Promise<IPagination<IEmailHistory>> {
		const query = this.typeOrmRepository.createQueryBuilder('email_sent');
		query.leftJoin(`email_sent.user`, 'user');
		query.leftJoin(`email_sent.emailTemplate`, 'emailTemplate');
		query.addSelect(['user.email', 'user.firstName', 'user.lastName', 'user.imageUrl']);

		const { organizationId, tenantId } = filter.where as any;
		query.where(p(`
			"${query.alias}"."organizationId" = :organizationId
			AND
			"${query.alias}"."tenantId" = :tenantId
			AND
			"${query.alias}"."isArchived" = :isArchived
			AND
			"${query.alias}"."isActive" = :isActive
		`),
			{
				organizationId,
				tenantId,
				isArchived: false,
				isActive: true
			}
		);

		query.take(filter.take ? (filter.take as number) : 20);
		query.orderBy(`${query.alias}.createdAt`, 'DESC');

		const [items, total] = await query.getManyAndCount();
		return {
			items,
			total
		};
	}
}
