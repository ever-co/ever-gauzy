import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class HelpCenterService extends TenantAwareCrudService<HelpCenter> {
	constructor(
		@InjectRepository(HelpCenter)
		private readonly HelpCenterRepository: Repository<HelpCenter>
	) {
		super(HelpCenterRepository);
	}
	async createBulk(updateInput: IHelpCenter[]) {
		return await this.repository.save(updateInput);
	}
	async getAllNodes(): Promise<HelpCenter[]> {
		return await this.repository
			.createQueryBuilder('knowledge_base')
			.getMany();
	}
	// TODO
	// async getInterviewersByInterviewId(
	// 	interviewId: string
	// ): Promise<CandidateInterviewers[]> {
	// 	return await this.repository
	// 		.createQueryBuilder('candidate_interviewers')
	// 		.where('candidate_interviewers.interviewId = :interviewId', {
	// 			interviewId
	// 		})
	// 		.getMany();
	// }
}
