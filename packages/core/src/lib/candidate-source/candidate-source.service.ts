import { Injectable } from '@nestjs/common';
import { ICandidateSource } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmCandidateSourceRepository } from './repository/type-orm-candidate-source.repository';
import { MikroOrmCandidateSourceRepository } from './repository/mikro-orm-candidate-source.repository';
import { CandidateSource } from './candidate-source.entity';

@Injectable()
export class CandidateSourceService extends TenantAwareCrudService<CandidateSource> {
	constructor(
		typeOrmCandidateSourceRepository: TypeOrmCandidateSourceRepository,
		mikroOrmCandidateSourceRepository: MikroOrmCandidateSourceRepository
	) {
		super(typeOrmCandidateSourceRepository, mikroOrmCandidateSourceRepository);
	}

	/**
	 *
	 * @param sources
	 * @returns
	 */
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
