import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { CandidateSkill } from './candidate-skill.entity';

@Injectable()
export class CandidateSkillService extends TenantAwareCrudService<CandidateSkill> {
	constructor(
		@InjectRepository(CandidateSkill)
		private readonly candidateSkillRepository: Repository<CandidateSkill>,
		@MikroInjectRepository(CandidateSkill)
		private readonly mikroCandidateSkillRepository: EntityRepository<CandidateSkill>
	) {
		super(candidateSkillRepository, mikroCandidateSkillRepository);
	}
}
