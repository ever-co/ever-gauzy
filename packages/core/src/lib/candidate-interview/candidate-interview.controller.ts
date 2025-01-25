import { Controller, HttpStatus, Get, Query, Body, Post, UseGuards, Param, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import {
	ICandidate,
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
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';

@ApiTags('CandidateInterview')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
@Controller('/candidate-interview')
export class CandidateInterviewController extends CrudController<CandidateInterview> {
	constructor(private readonly candidateInterviewService: CandidateInterviewService) {
		super(candidateInterviewService);
	}

	/**
	 * GET candidate interviews by candidate id
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
	@Get('candidate/:id')
	async findByCandidateId(@Param('id', UUIDValidationPipe) id: ICandidate['id']): Promise<ICandidateInterview[]> {
		return await this.candidateInterviewService.findByCandidateId(id);
	}

	/**
	 * GET candidate interview count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate interviews count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviews count'
	})
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<CandidateInterview>): Promise<number> {
		return await this.candidateInterviewService.countBy(options);
	}

	/**
	 * GET candidate interviews by pagination
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all candidate interviews in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate interviews in the tenant',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<CandidateInterview>): Promise<IPagination<ICandidateInterview>> {
		return await this.candidateInterviewService.paginate(params);
	}

	/**
	 * GET candidate interviews
	 *
	 * @param params
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
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<CandidateInterview>): Promise<IPagination<ICandidateInterview>> {
		return await this.candidateInterviewService.findAll(params);
	}

	/**
	 * GET candidate interview by id
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Find candidate interview by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found interview',
		type: CandidateInterview
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ICandidateInterview['id']): Promise<ICandidateInterview> {
		return this.candidateInterviewService.findOneByIdString(id);
	}

	/**
	 * CREATE candidate interview
	 *
	 * @param entity
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
	@Post()
	async create(@Body() entity: ICandidateInterviewCreateInput): Promise<ICandidateInterview> {
		return await this.candidateInterviewService.create(entity);
	}

	/**
	 * UPDATE candidate interview by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidateInterview['id'],
		@Body() entity: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview | UpdateResult> {
		return await this.candidateInterviewService.update(id, entity);
	}
}
