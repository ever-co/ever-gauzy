import { CandidateInterviewers } from './candidate-interviewers.entity';
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
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import {
	PermissionsEnum,
	ICandidateInterviewersCreateInput
} from '@gauzy/models';

@ApiTags('candidate_interviewers')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateInterviewersController extends CrudController<
	CandidateInterviewers
> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService
	) {
		super(candidateInterviewersService);
	}
	@ApiOperation({
		summary: 'Find all candidate interviewers.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviewers',
		type: CandidateInterviewers
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findInterviewers(
		@Query('data') data: string
	): Promise<IPagination<CandidateInterviewers>> {
		const { findInput } = JSON.parse(data);
		return this.candidateInterviewersService.findAll({ where: findInput });
	}

	@ApiOperation({
		summary: 'Create new record interviewers'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Success Add Interviewers',
		type: CandidateInterviewers
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Post()
	async createInterviewer(
		@Body() entity: ICandidateInterviewersCreateInput
	): Promise<any> {
		return this.candidateInterviewersService.create(entity);
	}

	@Get('getByInterviewId/:interviewId')
	async findByName(
		@Param('interviewId') interviewId: string
	): Promise<CandidateInterviewers[]> {
		return this.candidateInterviewersService.findInterviewersByInterviewId(
			interviewId
		);
	}
}
