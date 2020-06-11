import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Put,
	Param,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum, ICandidateCriterionCreateInput } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { ParseJsonPipe } from '../shared';
import { CandidateCriterions } from './candidate-criterions.entity';
import { CandidateCriterionsService } from './candidate-criterions.service';

@ApiTags('candidate_criterion')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateCriterionsController extends CrudController<
	CandidateCriterions
> {
	constructor(
		private readonly candidateCriterionsService: CandidateCriterionsService
	) {
		super(candidateCriterionsService);
	}
	@ApiOperation({
		summary: 'Find all candidate criterions.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found candidate criterions',
		type: CandidateCriterions
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findCriterions(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<CandidateCriterions>> {
		const { relations = [], findInput = null } = data;
		return this.candidateCriterionsService.findAll({
			where: findInput,
			relations
		});
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Post()
	async createCriterion(
		@Body() entity: ICandidateCriterionCreateInput
	): Promise<any> {
		return this.candidateCriterionsService.create(entity);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Put(':id')
	async updateCriterion(
		@Param() id: string,
		@Body() entity: any
	): Promise<any> {
		return this.candidateCriterionsService.update(id, { ...entity });
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	@Delete()
	async deleteCriterions(@Param() id: string): Promise<any> {
		return this.candidateCriterionsService.delete(id);
	}
}
