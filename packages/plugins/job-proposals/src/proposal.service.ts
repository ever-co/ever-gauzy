import { Injectable } from '@nestjs/common';
import { FindManyOptions, Between, Raw } from 'typeorm';
import * as moment from 'moment';
import { IProposal, IPagination } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { TenantAwareCrudService } from '@gauzy/core';
import { Proposal } from './proposal.entity';
import { MikroOrmProposalRepository, TypeOrmProposalRepository } from './repository';

@Injectable()
export class ProposalService extends TenantAwareCrudService<Proposal> {
	constructor(
		readonly typeOrmProposalRepository: TypeOrmProposalRepository,
		readonly mikroOrmProposalRepository: MikroOrmProposalRepository
	) {
		super(typeOrmProposalRepository, mikroOrmProposalRepository);
	}

	/**
	 *
	 * @param filter
	 * @param filterDate
	 * @returns
	 */
	async getAllProposals(
		filter?: FindManyOptions<IProposal>, filterDate?: string
	): Promise<IPagination<IProposal>> {
		const total = await this.typeOrmRepository.count(filter);
		let items = await this.typeOrmRepository.find(filter);

		if (filterDate) {
			const dateObject = new Date(filterDate);

			const month = dateObject.getMonth() + 1;
			const year = dateObject.getFullYear();

			items = items.filter((i) => {
				const currentItemMonth = i.valueDate.getMonth() + 1;
				const currentItemYear = i.valueDate.getFullYear();
				return currentItemMonth === month && currentItemYear === year;
			});
		}

		return { items, total };
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	public async pagination(filter: FindManyOptions) {
		if ('where' in filter) {
			const { where } = filter;
			const likeOperator = isPostgres() ? 'ILIKE' : 'LIKE';
			if ('valueDate' in where) {
				const { valueDate } = where;
				const { startDate, endDate } = valueDate;
				if (startDate && endDate) {
					filter['where']['valueDate'] = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter['where']['valueDate'] = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('jobPostContent' in where) {
				const { jobPostContent } = where;
				filter['where']['jobPostContent'] = Raw((alias) => `${alias} ${likeOperator} '%${jobPostContent}%'`);
			}
		}
		return await super.paginate(filter);
	}
}
