import {
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Controller,
	Body,
	Delete,
	Put
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { ICandidateCriterionsRating, RolesEnum } from '@gauzy/models';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { CandidateCriterionsRatingBulkCreateCommand } from './commands/candidate-criterions-rating.bulk.create.command';
import { ParseJsonPipe } from '../shared';
import { CandidateCriterionsRatingBulkDeleteCommand } from './commands/candidate-criterions-rating.bulk.delete.command';
import { CandidateCriterionsRatingBulkUpdateCommand } from './commands';

@ApiTags('candidate_criterion_rating')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateCriterionsRatingController extends CrudController<
	CandidateCriterionsRating
> {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private commandBus: CommandBus
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

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post('createBulk')
	async createBulk(
		@Body() input: any
	): Promise<ICandidateCriterionsRating[]> {
		const { feedbackId = null, technologies = [], qualities = [] } = input;
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkCreateCommand(
				feedbackId,
				technologies,
				qualities
			)
		);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Put('updateBulk')
	async updateBulk(
		@Body()
		data: {
			criterionsRating: ICandidateCriterionsRating[];
			technologies: number[];
			personalQualities: number[];
		}
	): Promise<ICandidateCriterionsRating[]> {
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkUpdateCommand(data)
		);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete('deleteBulk')
	async deleteBulk(@Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(
			new CandidateCriterionsRatingBulkDeleteCommand(id)
		);
	}
}
