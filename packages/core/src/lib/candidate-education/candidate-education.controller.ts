import { Controller, HttpStatus, Get, Query, UseGuards, Post, Body, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { ICandidateEducation, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateEducationService } from './candidate-education.service';
import { CandidateEducation } from './candidate-education.entity';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateCandidateEducationDTO, UpdateCandidateEducationDTO } from './dto';

@ApiTags('CandidateEducation')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller('/candidate-educations')
export class CandidateEducationController extends CrudController<CandidateEducation> {
	constructor(private readonly candidateEducationService: CandidateEducationService) {
		super(candidateEducationService);
	}

	/**
	 * GET candidate educations by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<CandidateEducation>): Promise<IPagination<ICandidateEducation>> {
		return await this.candidateEducationService.paginate(params);
	}

	/**
	 * GET candidate educations
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all candidate education.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate education',
		type: CandidateEducation
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<CandidateEducation>): Promise<IPagination<ICandidateEducation>> {
		return await this.candidateEducationService.findAll({
			where: params.where
		});
	}

	/**
	 * CREATE candidate education
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCandidateEducationDTO): Promise<ICandidateEducation> {
		return await this.candidateEducationService.create(entity);
	}

	/**
	 * UPDATE candidate education
	 *
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidateEducation['id'],
		@Body() entity: UpdateCandidateEducationDTO
	): Promise<ICandidateEducation | UpdateResult> {
		return await this.candidateEducationService.update(id, entity);
	}
}
