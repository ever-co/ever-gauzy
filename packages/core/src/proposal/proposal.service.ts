import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, Like } from 'typeorm';
import * as moment from 'moment';
import { Proposal } from './proposal.entity';
import { IProposalCreateInput, IProposal, IPagination } from '@gauzy/contracts';
import { Employee } from '../employee/employee.entity';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class ProposalService extends TenantAwareCrudService<Proposal> {
	constructor(
		@InjectRepository(Proposal)
		private readonly proposalRepository: Repository<Proposal>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(proposalRepository);
	}

	async getAllProposals(
		filter?: FindManyOptions<IProposal>,
		filterDate?: string
	): Promise<IPagination<IProposal>> {
		const total = await this.repository.count(filter);
		let items = await this.repository.find(filter);

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

		await this.employeeRepository.findOneOrFail(entity.employeeId);

		return this.proposalRepository.save(proposal);
	}

	public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('valueDate' in where) {
				const { valueDate } = where;
				const { startDate, endDate } = valueDate;

				if (startDate && endDate) {
					filter.where.valueDate = Between(
						moment.utc(startDate).format('YYYY-MM-DD HH:mm:ss'),
						moment.utc(endDate).format('YYYY-MM-DD HH:mm:ss')
					);
				} else {
					filter.where.valueDate = Between(
						moment().startOf('month').utc().format('YYYY-MM-DD HH:mm:ss'),
						moment().endOf('month').utc().format('YYYY-MM-DD HH:mm:ss')
					);
				}
			}
			if ('jobPostContent' in where) {
				const { jobPostContent } = where;
				filter.where.jobPostContent = Like(`%${jobPostContent}%`);
			}
		}
		return super.paginate(filter);
	}
}
