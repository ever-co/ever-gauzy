import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';

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
}
