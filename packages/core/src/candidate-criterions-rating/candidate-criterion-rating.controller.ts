import {
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Controller,
	Body,
	Delete,
	Put,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { ICandidateCriterionsRating, IPagination, RolesEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { 
	CandidateCriterionsRatingBulkCreateCommand,
	CandidateCriterionsRatingBulkDeleteCommand,
	CandidateCriterionsRatingBulkUpdateCommand
} from './commands';

@ApiTags('CandidateCriterionRating')
@UseGuards(TenantPermissionGuard)
@Controller()
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
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('bulk')
	async createBulk(
		@Body() body: any
	): Promise<ICandidateCriterionsRating[]> {
		const { feedbackId = null, technologies = [], qualities = [] } = body;
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkCreateCommand(
				feedbackId,
				technologies,
				qualities
			)
		);
	}

	/**
	 * UPDATE bulk candidate criterions rating
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put('bulk')
	async updateBulk(
		@Body()
		body: {
			criterionsRating: ICandidateCriterionsRating[];
			technologies: number[];
			personalQualities: number[];
		}
	): Promise<ICandidateCriterionsRating[]> {
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkUpdateCommand(body)
		);
	}

	/**
	 * GET all candidate criterions rating
	 * 
	 * @param data 
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateCriterionsRating>> {
		const { findInput } = data;
		return this.candidateCriterionsRatingService.findAll({
			where: findInput
		});
	}

	/**
	 * DELETE candidate criterions rating by feedback id
	 * 
	 * @param feedbackId 
	 * @returns 
	 */
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('feedback/:feedbackId')
	async deleteBulkByFeedbackId(
		@Param('id', UUIDValidationPipe) feedbackId: string,
	): Promise<any> {
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkDeleteCommand(feedbackId)
		);
	}
}
