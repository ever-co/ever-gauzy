import { Injectable, BadRequestException } from '@nestjs/common';
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
	async deleteSkill(skillId) {
		const skill = await this.candidateSkillRepository
			.createQueryBuilder('skill')
			.getOne();
		if (!skill) {
			throw new BadRequestException("This Skill can't be deleted ");
		}

		return await this.delete(skillId);
	}
}
