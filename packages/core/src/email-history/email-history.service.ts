import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions } from 'typeorm';
import { IEmailHistory, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { EmailHistory } from './email-history.entity';
import { TypeOrmEmailHistoryRepository } from './repository/type-orm-email-history.repository';
import { MikroOrmEmailHistoryRepository } from './repository/mikro-orm-email-history.repository';

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
		return await super.findAll({
			select: {
				user: {
					email: true,
					firstName: true,
					lastName: true,
					imageUrl: true
				}
			},
			where: filter.where,
			relations: filter.relations || [],
			order: {
				createdAt: 'DESC'
			},
			take: filter.take
		});
	}
}
