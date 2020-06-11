import {
	Controller,
	UseGuards,
	Post,
	Body,
	Delete,
	Param
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../shared/guards/auth/role.guard';
import { Roles } from '../shared/decorators/roles';
import { RolesEnum } from '@gauzy/models';
import { CandidateTechnologiesService } from './candidate-technologies.service';
import { CandidateTechnologies } from './candidate-technologies.entity';

@ApiTags('candidate_technology')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateTechnologiesController extends CrudController<
	CandidateTechnologies
> {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService
	) {
		super(candidateTechnologiesService);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Post()
	async addTechnology(@Body() entity: CandidateTechnologies): Promise<any> {
		return this.candidateTechnologiesService.create(entity);
	}

	@UseGuards(RoleGuard)
	@Roles(RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Delete(':id')
	deleteTechnology(@Param() id: string): Promise<any> {
		return this.candidateTechnologiesService.delete(id);
	}
}
