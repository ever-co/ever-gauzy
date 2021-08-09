import { CandidateSource } from './candidate-source.entity';
import {
	Post,
	UseGuards,
	HttpStatus,
	Get,
	Query,
	Body,
	Controller,
	Put
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ICandidateSource } from '@gauzy/contracts';
import { CrudController, IPagination } from './../core/crud';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';
import { CandidateSourceService } from './candidate-source.service';

@ApiTags('CandidateSource')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateSourceController extends CrudController<CandidateSource> {
	constructor(
		private readonly candidateSourceService: CandidateSourceService
	) {
		super(candidateSourceService);
	}

	/**
	 * UPDATE bulk candidate source
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Update candidate source.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Updated candidate source',
		type: CandidateSource
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Put('bulk')
	async updateBulk(
		@Body() body: ICandidateSource[]
	): Promise<ICandidateSource[]> {
		return await this.candidateSourceService.updateBulk(body);
	}

	/**
	 * GET all candidate sources
	 * 
	 * @param data 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Find all candidate source.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate source',
		type: CandidateSource
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateSource>> {
		const { findInput } = data;
		return this.candidateSourceService.findAll({ where: findInput });
	}

	/**
	 * CREATE new candiate source
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({
		summary: 'Create candidate source.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Created candidate source',
		type: CandidateSource
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async create(
		@Body() entity: CandidateSource
	): Promise<ICandidateSource> {
		return this.candidateSourceService.create(entity);
	}
}
