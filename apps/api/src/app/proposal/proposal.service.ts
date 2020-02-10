import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Proposal } from './proposal.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';
import {
	ProposalCreateInput as IProposalCreateInput,
	Proposal as IProposal
} from '@gauzy/models';
import { Employee } from '../employee';

@Injectable()
export class ProposalService extends CrudService<Proposal> {
	constructor(
		@InjectRepository(Proposal)
		private readonly proposalRepository: Repository<Proposal>,
		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(proposalRepository);
	}

	async getAllProposals(
		filter?: FindManyOptions<Proposal>,
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
}
