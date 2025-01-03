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
import { UpdateResult } from 'typeorm';
import { ICandidateSkill, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateCandidateSkillDTO, UpdateCandidateSkillDTO } from './dto';

@ApiTags('CandidateSkill')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
@Controller()
export class CandidateSkillController extends CrudController<CandidateSkill> {
	constructor(private readonly candidateSkillService: CandidateSkillService) {
		super(candidateSkillService);
	}

	/**
	 * GET candidate skills by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<CandidateSkill>): Promise<IPagination<ICandidateSkill>> {
		return await this.candidateSkillService.paginate(params);
	}

	/**
	 * GET candidate skills
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all candidate skill.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate skill',
		type: CandidateSkill
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<CandidateSkill>): Promise<IPagination<ICandidateSkill>> {
		return await this.candidateSkillService.findAll({
			where: params.where
		});
	}

	/**
	 * CREATE candidate skill
	 *
	 * @param entity
	 * @returns
	 */
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateCandidateSkillDTO): Promise<ICandidateSkill> {
		return await this.candidateSkillService.create(entity);
	}

	/**
	 * UPDATE candidate skill
	 *
	 * @param entity
	 * @returns
	 */
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ICandidateSkill['id'],
		@Body() entity: UpdateCandidateSkillDTO
	): Promise<ICandidateSkill | UpdateResult> {
		return await this.candidateSkillService.update(id, entity);
	}
}
