import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { IEmailHistory, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { EmailHistory } from './email-history.entity';

@Injectable()
export class EmailHistoryService extends TenantAwareCrudService<EmailHistory> {
	constructor(
		@InjectRepository(EmailHistory)
		emailRepository: Repository<EmailHistory>,
		@MikroInjectRepository(EmailHistory)
		mikroEmailRepository: EntityRepository<EmailHistory>
	) {
		super(emailRepository, mikroEmailRepository);
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
