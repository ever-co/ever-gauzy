import { CandidateSource } from './candidate-source.entity';
import { Post, UseGuards, HttpStatus, Get, Query, Body, Controller, Put, Param } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateSource, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CandidateSourceService } from './candidate-source.service';
import { CreateCandidateSourceDTO, UpdateCandidateSourceDTO } from './dto';

@ApiTags('CandidateSource')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller('/candidate-source')
export class CandidateSourceController extends CrudController<CandidateSource> {
	constructor(private readonly candidateSourceService: CandidateSourceService) {
		super(candidateSourceService);
	}

	/**
	 * GET candidate sources by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<CandidateSource>): Promise<IPagination<ICandidateSource>> {
		return await this.candidateSourceService.paginate(params);
	}

	/**
	 * GET candidate sources
	 *
	 * @param params
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
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<CandidateSource>): Promise<IPagination<ICandidateSource>> {
		return await this.candidateSourceService.findAll({
			where: params.where
		});
	}

	/**
	 * CREATE candidate source
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
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCandidateSourceDTO): Promise<ICandidateSource> {
		return await this.candidateSourceService.create(entity);
	}

	/**
	 * UPDATE candidate source
	 *
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidateSource['id'],
		@Body() entity: UpdateCandidateSourceDTO
	): Promise<ICandidateSource | UpdateResult> {
		return await this.candidateSourceService.update(id, entity);
	}
}
