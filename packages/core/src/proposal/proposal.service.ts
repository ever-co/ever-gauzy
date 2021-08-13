import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, ILike } from 'typeorm';
import * as moment from 'moment';
import { Proposal } from './proposal.entity';
import { getDateRangeFormat } from './../core/utils';
import { IProposalCreateInput, IProposal, IPagination } from '@gauzy/contracts';
import { Employee } from '../employee/employee.entity';
import { TenantAwareCrudService } from './../core/crud';
const puppeteer = require('puppeteer');

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
				const { start, end } = getDateRangeFormat(
					new Date(moment(valueDate).startOf('month').format()),
					new Date(moment(valueDate).endOf('month').format()),
					true
				);
				filter.where.valueDate = Between(start, end); 
			}
			if ('jobPostContent' in where) {
				const { jobPostContent } = where;
				filter.where.jobPostContent = ILike(`%${jobPostContent}%`);
			}
		}
		return super.paginate(filter);
	}

	async getDataFromUrl(jobPostUrl: string): Promise<any> {
		try {
			const browser = await puppeteer.launch();
			const [page] = await browser.pages();
			await page.goto(jobPostUrl, { waitUntil: 'networkidle0' });
			const data = await page.evaluate(() => document.documentElement.outerHTML);
			await browser.close();			
			return { data }		
		} catch (err) {
			return err;
		}
	} 
}
