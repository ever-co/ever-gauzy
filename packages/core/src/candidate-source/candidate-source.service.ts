import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ICandidateSource } from '@gauzy/contracts';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateSource } from './candidate-source.entity';

@Injectable()
export class CandidateSourceService extends TenantAwareCrudService<CandidateSource> {
	constructor(
		@InjectRepository(CandidateSource)
		candidateSourceRepository: Repository<CandidateSource>,
		@MikroInjectRepository(CandidateSource)
		mikroCandidateSourceRepository: EntityRepository<CandidateSource>
	) {
		super(candidateSourceRepository, mikroCandidateSourceRepository);
	}

	async createBulk(sources: ICandidateSource[]): Promise<ICandidateSource[]> {
		const candidateSources: ICandidateSource[] = [];
		if (sources) {
			for await (const source of sources) {
				candidateSources.push(await this.create(source));
			}
		}
		return candidateSources;
	}
}
