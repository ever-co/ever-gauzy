import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Delete,
	Param,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ICandidateSkill,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CreateCandidateSkillDTO } from './dto';

@ApiTags('CandidateSkill')
@UseGuards(TenantPermissionGuard)
@Controller()
export class CandidateSkillController extends CrudController<CandidateSkill> {
	constructor(private readonly candidateSkillService: CandidateSkillService) {
		super(candidateSkillService);
	}

	/**
	 * GET all candidate skills tenant base
	 * 
	 * @param data 
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ICandidateSkill>> {
		const { findInput } = data;
		return this.candidateSkillService.findAll({ where: findInput });
	}

	/**
	 * CREATE candidate skill
	 * 
	 * @param body 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post()
	@UsePipes(new ValidationPipe({ transform: true }))
	async create(@Body() body: CreateCandidateSkillDTO): Promise<ICandidateSkill> {
		return this.candidateSkillService.create(body);
	}

	/**
	 * DELETE candidate skill by id
	 * 
	 * @param id 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Delete(':id')
	delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.candidateSkillService.delete(id);
	}
}
