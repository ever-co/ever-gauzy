import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like,  } from 'typeorm';
import { Candidate } from './candidate.entity';
import { ICandidateCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { isNotEmpty } from '@gauzy/common';

@Injectable()
export class CandidateService extends TenantAwareCrudService<Candidate> {
	constructor(
		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>
	) {
		super(candidateRepository);
	}

	async createBulk(input: ICandidateCreateInput[]) {
		return Promise.all(
			input.map((candidate) => {
				candidate.user.tenant = {
					id: candidate.organization.tenantId
				};
				return this.create(candidate);
			})
		);
	}

  public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('user' in where) {
				const { user } = where;
				const { email, firstName } = user;

				if (isNotEmpty(email)) filter.where.user['email'] = Like(`%${email}%`);
				if (isNotEmpty(firstName)) filter.where.user['firstName'] = Like(`%${firstName}%`);
			}
		}
		return super.paginate(filter);
	}
}
