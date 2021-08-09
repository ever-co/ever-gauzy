import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Delete,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
	ICandidateSkill,
	IPagination,
	ISkillCreateInput,
	RolesEnum
} from '@gauzy/contracts';
import { CrudController } from '../core/crud';
import { CandidateSkill } from './candidate-skill.entity';
import { CandidateSkillService } from './candidate-skill.service';
import { RoleGuard, TenantPermissionGuard } from './../shared/guards';
import { Roles } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('CandidateSkill')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class CandidateSkillController extends CrudController<CandidateSkill> {
	constructor(private readonly candidateSkillService: CandidateSkillService) {
		super(candidateSkillService);
	}
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

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async create(@Body() entity: ISkillCreateInput): Promise<any> {
		return this.candidateSkillService.create(entity);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.candidateSkillService.delete(id);
	}
}
