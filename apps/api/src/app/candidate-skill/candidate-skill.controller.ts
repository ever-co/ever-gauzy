import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Delete,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum } from '@gauzy/models';

@ApiTags('candidate_skills')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateSkillController extends CrudController<CandidateSkill> {
	constructor(private readonly candidateSkillService: CandidateSkillService) {
		super(candidateSkillService);
	}
	@ApiOperation({
		summary: 'Find all candidate skill.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate skill',
		type: CandidateSkill
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findSkill(
		@Query('data') data: string
	): Promise<IPagination<CandidateSkill>> {
		const { findInput } = JSON.parse(data);
		return this.candidateSkillService.findAll({ where: findInput });
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE)
	@Post()
	async addSkill(@Body() entity: CandidateSkill): Promise<any> {
		return this.candidateSkillService.create(entity);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE)
	@Delete(':id')
	deleteCandidateSkill(@Param() id: string): Promise<any> {
		return this.candidateSkillService.delete(id);
	}
}
