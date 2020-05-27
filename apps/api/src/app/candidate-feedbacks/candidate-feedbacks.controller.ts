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
	Delete,
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
		summary: 'Find all candidate feedback.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedback',
		type: CandidateFeedback,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get()
	async findFeedback(
		@Query('data') data: string
	): Promise<IPagination<CandidateFeedback>> {
		const { findInput } = JSON.parse(data);
		return this.candidateFeedbacksService.findAll({ where: findInput });
	}

	@ApiOperation({
		summary: 'Find feedbacks By Interview Id.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate feedbacks',
		type: CandidateFeedback,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
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
		@Param() id: string,
		@Body() entity: any
	): Promise<any> {
		return this.candidateFeedbacksService.update(id, { ...entity });
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Delete()
	async deleteCandidateFeedback(@Param() id: string): Promise<any> {
		return this.candidateFeedbacksService.delete(id);
	}
}
