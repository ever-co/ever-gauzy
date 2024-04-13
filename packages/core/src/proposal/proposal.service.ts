import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Between, Raw } from 'typeorm';
import * as moment from 'moment';
import { Proposal } from './proposal.entity';
import { IProposalCreateInput, IProposal, IPagination } from '@gauzy/contracts';
import { isPostgres } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { MikroOrmProposalRepository } from './repository/mikro-orm-proposal.repository';
import { TypeOrmProposalRepository } from './repository/type-orm-proposal.repository';

@Injectable()
export class ProposalService extends TenantAwareCrudService<Proposal> {
	constructor(
		@InjectRepository(Proposal)
		typeOrmProposalRepository: TypeOrmProposalRepository,

		mikroOrmProposalRepository: MikroOrmProposalRepository
	) {
		super(typeOrmProposalRepository, mikroOrmProposalRepository);
	}

	async getAllProposals(filter?: FindManyOptions<IProposal>, filterDate?: string): Promise<IPagination<IProposal>> {
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

	async createProposal(entity: IProposalCreateInput): Promise<Proposal> {
		const proposal = new Proposal();
		proposal.jobPostUrl = entity.jobPostUrl;
		proposal.valueDate = entity.valueDate;
		proposal.jobPostContent = entity.jobPostContent;
		proposal.proposalContent = entity.proposalContent;
		proposal.employeeId = entity.employeeId;
		return this.typeOrmRepository.save(proposal);
	}

	public pagination(filter: FindManyOptions) {
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
		return super.paginate(filter);
	}
}
