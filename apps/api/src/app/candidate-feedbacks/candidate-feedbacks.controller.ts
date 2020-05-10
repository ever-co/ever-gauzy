import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('candidate_feedbacks')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateFeedbacksController extends CrudController<
	CandidateFeedback
> {
	constructor(
		private readonly candidateFeedbacksService: CandidateFeedbacksService
	) {
		super(candidateFeedbacksService);
	}
	@ApiOperation({
		summary: 'Find all candidate feedback.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedback',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findFeedback(
		@Query('data') data: string
	): Promise<IPagination<CandidateFeedback>> {
		const { findInput } = JSON.parse(data);
		return this.candidateFeedbacksService.findAll({ where: findInput });
	}
}
