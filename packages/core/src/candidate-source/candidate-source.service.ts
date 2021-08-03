import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateSource } from './candidate-source.entity';
import { ICandidateSource } from '@gauzy/contracts';

@Injectable()
export class CandidateSourceService extends TenantAwareCrudService<CandidateSource> {
	constructor(
		@InjectRepository(CandidateSource)
		private readonly candidateSourceRepository: Repository<CandidateSource>
	) {
		super(candidateSourceRepository);
	}
	updateBulk(updateInput: ICandidateSource[]): Promise<any> {
		updateInput.forEach(async (item) => {
			await this.candidateSourceRepository.save(item);
		});
		return;
	}
}
