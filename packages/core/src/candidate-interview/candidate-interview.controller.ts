import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Body,
	Post,
	UseGuards,
	Param,
	Put,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import {
	ICandidateInterview,
	ICandidateInterviewCreateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateInterview } from './candidate-interview.entity';
import { CandidateInterviewService } from './candidate-interview.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { RequestContext } from './../core/context';

@ApiTags('CandidateInterview')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CandidateInterviewController extends CrudController<CandidateInterview> {
	constructor(
		private readonly candidateInterviewService: CandidateInterviewService
	) {
		super(candidateInterviewService);
	}

	/**
	 * GET candidate interview by candidate id
	 * 
	 * @param id 
	 * @returns 
	 */
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
	@Get('candidate/:id')
	async findByCandidateId(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ICandidateInterview[]> {
		return await this.candidateInterviewService.findByCandidateId(id);
	}

	/**
	 * GET candidate interview count
	 * 
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all candidate interviews in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviews count'
	})
	@Get('count')
    async getCount(
		@Query() filter: PaginationParams<ICandidateInterview>
	): Promise<number> {
        return await this.candidateInterviewService.count({
			where: {
				tenantId: RequestContext.currentTenantId()
			},
			...filter
		});
    }

	/**
	 * GET candidate intreview by pagination
	 * 
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all candidate interviews in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate intreviews in the tenant',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ICandidateInterview>
	): Promise<IPagination<ICandidateInterview>> {
		return this.candidateInterviewService.paginate(filter);
	}

	/**
	 * GET all candidate interview
	 * 
	 * @param data 
	 * @returns 
	 */
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateInterview>> {
		const { relations = [], findInput = null } = data;
		return this.candidateInterviewService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET candidate interview by id
	 * 
	 * @param id 
	 * @returns 
	 */
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
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ICandidateInterview> {
		return this.candidateInterviewService.findOne(id);
	}

	/**
	 * CREATE candidate interview
	 * 
	 * @param body 
	 * @returns 
	 */
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
	async create(
		@Body() body: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview> {
		return this.candidateInterviewService.create(body);
	}

	/**
	 * UPDATE candidate interview by id
	 * 
	 * @param id 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() body: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview | UpdateResult> {
		return this.candidateInterviewService.update(id, {
			...body
		});
	}
}
