import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmCandidateSkillRepository } from './repository/type-orm-candidate-skill.repository';
import { MikroOrmCandidateSkillRepository } from './repository/mikro-orm-candidate-skill.repository';
import { CandidateSkill } from './candidate-skill.entity';

@Injectable()
export class CandidateSkillService extends TenantAwareCrudService<CandidateSkill> {
	constructor(
		typeOrmCandidateSkillRepository: TypeOrmCandidateSkillRepository,
		mikroOrmCandidateSkillRepository: MikroOrmCandidateSkillRepository
	) {
		super(typeOrmCandidateSkillRepository, mikroOrmCandidateSkillRepository);
	}
}
