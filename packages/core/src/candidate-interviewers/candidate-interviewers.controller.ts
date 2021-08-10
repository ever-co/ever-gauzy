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
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import {
	PermissionsEnum,
	ICandidateInterviewersCreateInput,
	ICandidateInterviewers,
	IPagination
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import {
	CandidateInterviewersEmployeeBulkDeleteCommand,
	CandidateInterviewersInterviewBulkDeleteCommand,
	CandidateInterviewersBulkCreateCommand
} from './commands';

@ApiTags('CandidateInterviewer')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CandidateInterviewersController extends CrudController<CandidateInterviewers> {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly commandBus: CommandBus
	) {
		super(candidateInterviewersService);
	}

	/**
	 * CREATE bulk candidate interviewers
	 * 
	 * @param body 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Create interviewers in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Interviewers have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('bulk')
	async createBulk(
		@Body() body: ICandidateInterviewersCreateInput
	): Promise<ICandidateInterviewers[]> {
		return await this.commandBus.execute(
			new CandidateInterviewersBulkCreateCommand(body)
		);
	}

	/**
	 * GET candidate interviewers by interview id
	 * 
	 * @param interviewId 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find Interviewers By Interview Id.'
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Get('interview/:interviewId')
	async findByInterviewId(
		@Param('interviewId', UUIDValidationPipe) interviewId: string
	): Promise<ICandidateInterviewers[]> {
		return await this.candidateInterviewersService.getInterviewersByInterviewId(
			interviewId
		);
	}

	/**
	 * DELETE bulk interviewer by interview id
	 * 
	 * @param id 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Delete Interviewers By Interview Id.'
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	@Delete('interview/:interviewId')
	async deleteBulkByInterviewId(
		@Param('interviewId', UUIDValidationPipe) id: string
	): Promise<any> {
		return await this.commandBus.execute(
			new CandidateInterviewersInterviewBulkDeleteCommand(id)
		);
	}

	/**
	 * DELETE candidate interviewers by bulk employee ids
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Delete Interviewers By employeeId.'
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

	/**
	 * GET all candidate interviewers
	 * 
	 * @param data 
	 * @returns 
	 */
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateInterviewers>> {
		const { findInput = null } = data;
		return this.candidateInterviewersService.findAll({ where: findInput });
	}

	/**
	 * CREATE candidate interviewer
	 * 
	 * @param body 
	 * @returns 
	 */
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
	async create(
		@Body() body: ICandidateInterviewersCreateInput
	): Promise<ICandidateInterviewers> {
		return this.candidateInterviewersService.create(body);
	}
}
