import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Body,
	Post,
	UseGuards,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';
import { CandidateInterview } from './candidate-interview.entity';
import { CandidateInterviewService } from './candidate-interview.service';
import { ICandidateInterviewCreateInput, PermissionsEnum } from '@gauzy/models';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { ParseJsonPipe } from '../shared';

@ApiTags('candidate_interview')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateInterviewController extends CrudController<
	CandidateInterview
> {
	constructor(
		private readonly candidateInterviewService: CandidateInterviewService
	) {
		super(candidateInterviewService);
	}
	@ApiOperation({
		summary: 'Find all candidate interview.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interview',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findInterview(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<CandidateInterview>> {
		const { relations = [], findInput = null } = data;
		return this.candidateInterviewService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({
		summary: 'Create new record interview'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Success Add Interview',
		type: CandidateInterview
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Post()
	async createInterview(
		@Body() entity: ICandidateInterviewCreateInput
	): Promise<any> {
		return this.candidateInterviewService.create(entity);
	}

	@ApiOperation({ summary: 'Find interview by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found interview',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Get(':id')
	async findById(@Param('id') id: string): Promise<CandidateInterview> {
		return this.candidateInterviewService.findOne(id);
	}

	@ApiOperation({ summary: 'Find interview by candidate id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found interview',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Get('findByCandidateId/:id')
	async findByCandidateId(
		@Param('id') id: string
	): Promise<CandidateInterview[]> {
		return this.candidateInterviewService.findByCandidateId(id);
	}
}
