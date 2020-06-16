import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { ICandidateCriterionsRating } from '@gauzy/models';

@ApiTags('candidate_criterion_rating')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateCriterionsRatingController extends CrudController<
	ICandidateCriterionsRating
> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService
	) {
		super(candidateCriterionsRatingService);
	}
	@ApiOperation({
		summary: 'Find all candidate criterion rating.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate criterion rating',
		type: CandidateCriterionsRating
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findCriterionRatings(
		@Query('data') data: string
	): Promise<IPagination<CandidateCriterionsRating>> {
		const { findInput } = JSON.parse(data);
		return this.candidateCriterionsRatingService.findAll({
			where: findInput
		});
	}
}
