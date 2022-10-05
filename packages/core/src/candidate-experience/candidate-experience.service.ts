import { IPagination } from '@gauzy/contracts';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateExperience } from './candidate-experience.entity';

@Injectable()
export class CandidateExperienceService extends TenantAwareCrudService<CandidateExperience> {
	constructor(
		@InjectRepository(CandidateExperience)
		private readonly candidateExperienceRepository: Repository<CandidateExperience>
	) {
		super(candidateExperienceRepository);
	}

	/**
	 *
	 * @param filter
	 * @returns
	 */
	public async findAll(filter?: FindManyOptions<CandidateExperience>): Promise<IPagination<CandidateExperience>> {
		return await super.findAll({
			select: {
				organization: {
					id: true,
					name: true,
					officialName: true
				}
			},
			...filter
		});
	}
}
