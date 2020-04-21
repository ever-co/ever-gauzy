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
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';

@ApiTags('candidate_experience')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateExperienceController extends CrudController<
	CandidateExperience
> {
	constructor(
		private readonly candidateExperienceService: CandidateExperienceService
	) {
		super(candidateExperienceService);
	}
	// GET
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
		description: "This Experience can't be deleted"
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id') id: string): Promise<any> {
		return this.candidateExperienceService.deleteExperience(id);
	}
}
