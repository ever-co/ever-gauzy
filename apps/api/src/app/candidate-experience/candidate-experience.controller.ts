import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';
import { IPagination } from '../core';

@ApiTags('candidate_experience')
@Controller()
export class CandidateExperienceController extends CrudController<
	CandidateExperience
> {
	constructor(
		private readonly candidateExperienceService: CandidateExperienceService
	) {
		super(candidateExperienceService);
	}

	@ApiOperation({
		summary: 'Find all candidate experience.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate experience',
		type: CandidateExperience
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findExperience(
		@Query('data') data: string
	): Promise<IPagination<CandidateExperience>> {
		const { findInput } = JSON.parse(data);
		return this.candidateExperienceService.findAll({ where: findInput });
	}
}
