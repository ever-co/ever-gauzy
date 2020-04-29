import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { Skill } from './skill.entity';
import { SkillService } from './skill.service';
@ApiTags('Skills')
@Controller()
export class SkillController extends CrudController<Skill> {
	constructor(private readonly skillService: SkillService) {
		super(skillService);
	}
}
