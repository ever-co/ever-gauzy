import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Put,
	Param,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum, ICandidateFeedbackCreateInput } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { ParseJsonPipe } from '../shared';
import { CommandBus } from '@nestjs/cqrs';
import { FeedbackUpdateCommand } from './commands/candidate-feedbacks.update.command';
import { FeedbackDeleteCommand } from './commands/candidate-feedbacks.delete.command';

@ApiTags('candidate_feedback')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateFeedbacksController extends CrudController<
	CandidateFeedback
> {
	constructor(
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly commandBus: CommandBus
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
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<CandidateFeedback>> {
		const { relations = [], findInput = null } = data;
		return this.candidateFeedbacksService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({
		summary: 'Find candidate feedback by id'
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
	@Get(':id')
	async findById(@Param('id') id: string): Promise<CandidateFeedback> {
		return this.candidateFeedbacksService.findOne(id);
	}

	@ApiOperation({
		summary: 'Find feedbacks By Interview Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedbacks',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	// TO DO
	// @Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT) TO DO
	@Get('getByInterviewId/:interviewId')
	async findByInterviewId(
		@Param('interviewId') interviewId: string
	): Promise<CandidateFeedback[]> {
		return this.candidateFeedbacksService.getFeedbacksByInterviewId(
			interviewId
		);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Post()
	async createFeedBack(
		@Body() entity: ICandidateFeedbackCreateInput
	): Promise<any> {
		return this.candidateFeedbacksService.create(entity);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Put(':id')
	async updateCandidateFeedback(
		@Param('id') id: string,
		@Body() entity: any
	): Promise<any> {
		return this.commandBus.execute(new FeedbackUpdateCommand(id, entity));
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Delete('deleteFeedback')
	async deleteFeedback(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		console.log('@@@@@@');
		const { interviewId = null, feedbackId = null } = data;
		return this.commandBus.execute(
			new FeedbackDeleteCommand(interviewId, feedbackId)
		);
	}
}
