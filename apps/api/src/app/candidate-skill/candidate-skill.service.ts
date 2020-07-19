import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { CandidateSkill } from './candidate-skill.entity';

@Injectable()
export class CandidateSkillService extends CrudService<CandidateSkill> {
	constructor(
		@InjectRepository(CandidateSkill)
		private readonly candidateSkillRepository: Repository<CandidateSkill>
	) {
		super(candidateSkillRepository);
	}
}
