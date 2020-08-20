import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Candidate } from './candidate.entity';
import { CandidateCreateInput } from '@gauzy/models';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';

@Injectable()
export class CandidateService extends TenantAwareCrudService<Candidate> {
	constructor(
		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>
	) {
		super(candidateRepository);
	}

	async createBulk(input: CandidateCreateInput[]) {
		return Promise.all(
			input.map((candidate) => {
				candidate.user.tenant = {
					id: candidate.organization.tenantId
				};
				return this.create(candidate);
			})
		);
	}
}
