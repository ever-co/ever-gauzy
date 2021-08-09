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
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { AuthGuard } from '@nestjs/passport';
import {
	PermissionsEnum,
	ICandidateFeedbackCreateInput,
	IPagination,
	ICandidateFeedback
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { FeedbackDeleteCommand, FeedbackUpdateCommand } from './commands';

@ApiTags('CandidateFeedback')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateFeedbacksController extends CrudController<CandidateFeedback> {
	constructor(
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly commandBus: CommandBus
	) {
		super(candidateFeedbacksService);
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
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<CandidateFeedback[]> {
		return this.candidateFeedbacksService.getFeedbacksByInterviewId(
			interviewId
		);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Delete('interview/:interviewId/:feedbackId')
	async deleteFeedback(
		@Param('interviewId', UUIDValidationPipe) interviewId: string,
		@Param('feedbackId', UUIDValidationPipe) feedbackId: string,
	): Promise<any> {
		return await this.commandBus.execute(
			new FeedbackDeleteCommand(feedbackId, interviewId)
		);
	}

	/*
	* Get Candidate Feedback Count 
	*/
	@ApiOperation({ summary: 'Find all candidate feedbacks counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates feedback count'
	})
	@Get('count')
    async getCount(
		@Query() filter: PaginationParams<ICandidateFeedback>
	): Promise<number> {
        return await this.candidateFeedbacksService.count(filter);
    }

	/*
	* Get Candidate Feedbacks By Pagination  
	*/
	@ApiOperation({ summary: 'Find all candidate feedbacks in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidates in the tenant',
		type: CandidateFeedback
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ICandidateFeedback>
	): Promise<IPagination<ICandidateFeedback>> {
		return this.candidateFeedbacksService.paginate(filter);
	}

	/*
	* Get Candidate Feedbacks
	*/
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateFeedback>> {
		const { relations = [], findInput = null } = data;
		return this.candidateFeedbacksService.findAll({
			where: findInput,
			relations
		});
	}

	/*
	* Get Candidate Feedback By Id
	*/
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
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ICandidateFeedback> {
		return this.candidateFeedbacksService.findOne(id);
	}

	/*
	* Create New Candidate Feedback
	*/
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Post()
	async create(
		@Body() entity: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.candidateFeedbacksService.create(entity);
	}

	/*
	* Update Candidate Feedback By Id
	*/
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.commandBus.execute(new FeedbackUpdateCommand(id, entity));
	}
}
