import { HttpStatus, Get, Query, UseGuards, Post, Controller, Body, Delete, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ICandidateCriterionsRating, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import {
	CandidateCriterionsRatingBulkCreateCommand,
	CandidateCriterionsRatingBulkDeleteCommand,
	CandidateCriterionsRatingBulkUpdateCommand
} from './commands';

@ApiTags('CandidateCriterionRating')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
@Controller('/candidate-criterions-rating')
export class CandidateCriterionsRatingController extends CrudController<CandidateCriterionsRating> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private readonly commandBus: CommandBus
	) {
		super(candidateCriterionsRatingService);
	}

	/**
	 * CREATE bulk candidate criterions rating
	 *
	 * @param body
	 * @returns
	 */
	@Post('bulk')
	async createBulk(@Body() body: any): Promise<ICandidateCriterionsRating[]> {
		const { feedbackId = null, technologies = [], qualities = [] } = body;
		return await this.commandBus.execute(
			new CandidateCriterionsRatingBulkCreateCommand(feedbackId, technologies, qualities)
		);
	}

	/**
	 * UPDATE bulk candidate criterions rating
	 *
	 * @param body
	 * @returns
	 */
	@Put('bulk')
	async updateBulk(
		@Body()
		body: {
			criterionsRating: ICandidateCriterionsRating[];
			technologies: number[];
			personalQualities: number[];
		}
	): Promise<ICandidateCriterionsRating[]> {
		return await this.commandBus.execute(new CandidateCriterionsRatingBulkUpdateCommand(body));
	}

	/**
	 * GET candidate criterions rating
	 *
	 * @param params
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(
		@Query() params: PaginationParams<CandidateCriterionsRating>
	): Promise<IPagination<ICandidateCriterionsRating>> {
		return await this.candidateCriterionsRatingService.findAll(params);
	}

	/**
	 * DELETE candidate criterions rating by feedback id
	 *
	 * @param feedbackId
	 * @returns
	 */
	@Delete('feedback/:feedbackId')
	async deleteBulkByFeedbackId(@Param('feedbackId', UUIDValidationPipe) feedbackId: string): Promise<any> {
		return await this.commandBus.execute(new CandidateCriterionsRatingBulkDeleteCommand(feedbackId));
	}
}
