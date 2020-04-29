import { Repository } from 'typeorm';
import { Skill } from './skill.entity';
import { CrudService } from '../core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class SkillService extends CrudService<Skill> {
	constructor(
		@InjectRepository(Skill)
		private readonly skillRepository: Repository<Skill>
	) {
		super(skillRepository);
	}
}
