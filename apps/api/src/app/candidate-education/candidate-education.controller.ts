import { CandidateEducationService } from './candidate-education.service';
import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateEducation } from './candidate-education.entity';
import { IPagination } from '../core';

@ApiTags('candidate_educations')
@Controller()
export class CandidateEducationController extends CrudController<
	CandidateEducation
> {
	constructor(
		private readonly candidateEducationService: CandidateEducationService
	) {
		super(candidateEducationService);
	}
	@ApiOperation({
		summary: 'Find all candidate education.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate education',
		type: CandidateEducation
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findEducations(
		@Query('data') data: string
	): Promise<IPagination<CandidateEducation>> {
		const { findInput } = JSON.parse(data);
		return this.candidateEducationService.findAll({ where: findInput });
	}
}
