import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';
import { CandidateHistoryService } from './candidate-history.service';
import { CandidateHistory } from './candidate-history.entity';

@ApiTags('candidate_history')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateHistoryController extends CrudController<
	CandidateHistory
> {
	constructor(
		private readonly candidateHistoryService: CandidateHistoryService
	) {
		super(candidateHistoryService);
	}
	@ApiOperation({
		summary: 'Find all candidate source.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate source',
		type: CandidateHistory
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findSource(
		@Query('data') data: string
	): Promise<IPagination<CandidateHistory>> {
		const { findInput } = JSON.parse(data);
		return this.candidateHistoryService.findAll({ where: findInput });
	}
}
