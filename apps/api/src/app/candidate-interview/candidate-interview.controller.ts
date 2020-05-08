import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';
import { CandidateInterview } from './candidate-interview.entity';
import { CandidateInterviewService } from './candidate-interview.service';

@ApiTags('candidate_interview')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateInterviewController extends CrudController<
	CandidateInterview
> {
	constructor(
		private readonly candidateInterviewService: CandidateInterviewService
	) {
		super(candidateInterviewService);
	}
	@ApiOperation({
		summary: 'Find all candidate interview.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interview',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findInterview(
		@Query('data') data: string
	): Promise<IPagination<CandidateInterview>> {
		const { findInput } = JSON.parse(data);
		return this.candidateInterviewService.findAll({ where: findInput });
	}
}
