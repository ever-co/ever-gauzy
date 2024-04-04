import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Put,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ICandidateExperience, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { UpdateResult } from 'typeorm';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateExperienceService } from './candidate-experience.service';
import { CandidateExperience } from './candidate-experience.entity';
import { Permissions } from './../shared/decorators';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateCandidateExperienceDTO, UpdateCandidateExperienceDTO } from './dto';

@ApiTags('CandidateExperience')
@UseGuards(TenantPermissionGuard, TenantPermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller()
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
	async pagination(
		@Query() params: PaginationParams<CandidateExperience>
	): Promise<IPagination<ICandidateExperience>> {
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
	async findAll(@Query() params: PaginationParams<CandidateExperience>): Promise<IPagination<ICandidateExperience>> {
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
