import {
	Controller,
	UseGuards,
	Get,
	Query,
	HttpStatus,
	HttpCode,
	Delete,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';

@ApiTags('candidate_skills')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateSkillController extends CrudController<CandidateSkill> {
	constructor(private readonly candidateSkillService: CandidateSkillService) {
		super(candidateSkillService);
	}
	// GET
	@ApiOperation({
		summary: 'Find all candidate skills.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate skills',
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

	// DELETE
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: "This Skill can't be deleted"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id') id: string): Promise<any> {
		return this.candidateSkillService.deleteSkill(id);
	}
}
