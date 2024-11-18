import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Skill } from './skill.entity';
import { SkillService } from './skill.service';
import { TenantPermissionGuard } from './../shared/guards';


@ApiTags('Skills')
@UseGuards(TenantPermissionGuard)
@Controller()
export class SkillController extends CrudController<Skill> {
	constructor(private readonly skillService: SkillService) {
		super(skillService);
	}

	@Get('getByName/:name')
	async findByName(@Param('name') name: string): Promise<Skill> {
		return this.skillService.findOneByName(name);
	}
}
