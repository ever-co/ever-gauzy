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

	async updateBulk(sources: ICandidateSource[]): Promise<any> {
		const candidateSources: ICandidateSource[] = [];
		if (sources) {
			for await (const source of sources) {
				candidateSources.push(
					await this.create(source)
				);
			}
		}
		return candidateSources;
	}
}
