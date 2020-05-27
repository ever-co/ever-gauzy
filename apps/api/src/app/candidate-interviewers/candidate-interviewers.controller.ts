import { CandidateInterviewers } from './candidate-interviewers.entity';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Body,
	Post,
	UseGuards,
	Param,
	Delete,
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
	ICandidateInterviewersCreateInput,
	ICandidateInterviewers,
} from '@gauzy/models';
import { ParseJsonPipe } from '../shared';
import { CommandBus } from '@nestjs/cqrs';
import {
	CandidateInterviewersEmployeeBulkDeleteCommand,
	CandidateInterviewersInterviewBulkDeleteCommand,
	CandidateInterviewersBulkCreateCommand,
} from './commands';

@ApiTags('candidate_interviewers')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateInterviewersController extends CrudController<
	CandidateInterviewers
> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly commandBus: CommandBus
	) {
		super(candidateInterviewersService);
	}
	@ApiOperation({
		summary: 'Find all candidate interviewers.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviewers',
		type: CandidateInterviewers,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get()
	async findInterviewers(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<CandidateInterviewers>> {
		const { findInput = null } = data;
		return this.candidateInterviewersService.findAll({ where: findInput });
	}

	@ApiOperation({
		summary: 'Create new record interviewers',
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Success Add Interviewers',
		type: CandidateInterviewers,
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Post()
	async createInterviewer(
		@Body() entity: ICandidateInterviewersCreateInput
	): Promise<any> {
		return this.candidateInterviewersService.create(entity);
	}

	@ApiOperation({ summary: 'Create interviewers in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Interviewers have been successfully created.',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('createBulk')
	async createBulk(@Body() input: any): Promise<ICandidateInterviewers[]> {
		const { interviewId = null, employeeIds = [] } = input;
		return this.commandBus.execute(
			new CandidateInterviewersBulkCreateCommand(interviewId, employeeIds)
		);
	}

	@ApiOperation({
		summary: 'Find Interviewers By Interview Id.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviewers',
		type: CandidateInterviewers,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Get('getByInterviewId/:interviewId')
	async findByInterviewId(
		@Param('interviewId') interviewId: string
	): Promise<CandidateInterviewers[]> {
		return this.candidateInterviewersService.getInterviewersByInterviewId(
			interviewId
		);
	}

	@ApiOperation({
		summary: 'Delete Interviewers By Interview Id.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviewers',
		type: CandidateInterviewers,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Delete('deleteBulkByInterviewId')
	async deleteBulkByInterviewId(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(
			new CandidateInterviewersInterviewBulkDeleteCommand(id)
		);
	}

	@ApiOperation({
		summary: 'Delete Interviewers By employeeId.',
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviewers',
		type: CandidateInterviewers,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Delete('deleteBulkByEmployeeId')
	async deleteBulkByEmployeeId(
		@Query('data', ParseJsonPipe) data: any
	): Promise<any> {
		const { deleteInput = null } = data;
		return this.commandBus.execute(
			new CandidateInterviewersEmployeeBulkDeleteCommand(deleteInput)
		);
	}
}
