import { Controller, HttpStatus, Get, Query, UseGuards, Post, Body, Put, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateExperience, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { UpdateResult } from 'typeorm';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateCandidateExperienceDTO, UpdateCandidateExperienceDTO } from './dto';

/**
 * The prior engagements a candidacy files.
 *
 * 🛑 The chain below used to read `@UseGuards(TenantPermissionGuard, TenantPermissionGuard)` — the
 * tenant guard twice, with `PermissionGuard` nowhere. `@Permissions` is metadata and does nothing on
 * its own: `PermissionGuard` is the only provider that reads `PERMISSIONS_METADATA`, so the class
 * permission below and the `ORG_CANDIDATES_VIEW` the two reads state were evaluated by nothing at
 * all, and every route of this controller — the list, the row, and the create and edit inherited from
 * the CRUD base — ran for any authenticated member of the tenant. The four sibling controllers of the
 * candidacy file (`candidate-educations`, `candidate-skills`, `candidate-source`,
 * `candidate-documents`) all state `(TenantPermissionGuard, PermissionGuard)` with the same class
 * permission, so the duplicate was a slip rather than a decision, and the declarations below are the
 * scope this resource was always meant to have.
 */
@ApiTags('CandidateExperience')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller('/candidate-experience')
export class CandidateExperienceController extends CrudController<CandidateExperience> {
	constructor(private readonly candidateExperienceService: CandidateExperienceService) {
		super(candidateExperienceService);
	}

	/**
	 * GET candidate experiences by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: BaseQueryDTO<CandidateExperience>): Promise<IPagination<ICandidateExperience>> {
		return await this.candidateExperienceService.paginate(params);
	}

	/**
	 * GET candidate experiences
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all candidate experience.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate experience',
		type: CandidateExperience
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: BaseQueryDTO<CandidateExperience>): Promise<IPagination<ICandidateExperience>> {
		return await this.candidateExperienceService.findAll(params);
	}

	/**
	 * CREATE candidate experience
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateCandidateExperienceDTO): Promise<ICandidateExperience> {
		return await this.candidateExperienceService.create(entity);
	}

	/**
	 * UPDATE candidate experience
	 *
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidateExperience['id'],
		@Body() entity: UpdateCandidateExperienceDTO
	): Promise<ICandidateExperience | UpdateResult> {
		return await this.candidateExperienceService.update(id, entity);
	}
}
